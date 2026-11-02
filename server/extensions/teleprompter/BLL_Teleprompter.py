# SPDX-License-Identifier: AGPL-3.0-or-later
"""What only a teleprompter needs, on the framework's records, plans, storage and AI.

Records (the framework's CRUD routes, ETag/If-Match on every write):

- ``/v1/script_folder``: folders a user (or, on the team plan, a team) files scripts in.
- ``/v1/script``: a script's title and Markdown text, its folder, star and where it was
  imported from; its word count is kept by the server.
- ``/v1/prompter_preference``: one per user, the display and scroll settings the
  prompter opens with (a JSON object the client owns).
- ``/v1/recording``: a take recorded in the browser (cloud recordings plan feature). Its
  video is put to ``PUT /v1/recording/{id}/content`` and read back from ``GET``; ``POST
  /v1/recording/{id}/captions`` transcribes it (captions feature) and ``GET
  /v1/recording/{id}/captions?format=vtt|srt`` serves the captions. Deleting a recording
  deletes its video.

Actions on ``/v1/teleprompter``:

- ``POST /ai`` (AI writer feature): write, shorten, lengthen, retone or translate a script.
- ``POST /transcribe`` (server voice feature): the words in a short audio clip, which the
  client's voice-follow scroll matches against the script.
"""

import base64
import json
import math
import re
from typing import Any, ClassVar, Literal

from fastapi import HTTPException, Request
from fastapi.responses import Response
from pydantic import BaseModel as ResponseModel
from pydantic import Field
from zephyrex.extensions.entitlements.BLL_Entitlements import require_feature, require_within_limit
from zephyrex.extensions.privacy.Erasure import register_eraser

# Registers Zephyreader's plans. Resolves only at runtime, through the extensions namespace path.
from zephyrex.extensions.teleprompter.Catalogue import (  # type: ignore[import-not-found]
    AI_WRITER,
    CAPTIONS,
    CLOUD_RECORDINGS,
    RECORDING_MEGABYTES,
    SERVER_VOICE,
    TEAM_SHARING,
)
from zephyrex.lib.ContentNegotiation import skip_negotiation
from zephyrex.lib.CustomRoute import ExposeIn, custom_route
from zephyrex.lib.Environment import env
from zephyrex.lib.Logging import logger
from zephyrex.lib.Preconditions import etag_headers
from zephyrex.logic.AbstractLogicManager import (
    AbstractBLLManager,
    ApplicationModel,
    ModelMeta,
    StringSearchModel,
    UpdateMixinModel,
)
from zephyrex.logic.BLL_Auth import TeamModel, UserModel
from zephyrex.pydantic2.fastapi import RouterMixin
from zephyrex.pydantic2.fastapi.types import RouteType

# The framework's registry BaseModel, which it re-exports without declaring it.
from zephyrex.pydantic2.registry import BaseModel  # type: ignore[attr-defined]

MAX_TITLE = 300
MAX_FOLDER_NAME = 120
# A script's Markdown, in characters (a feature-length script is well under 200k).
MAX_SCRIPT_CHARACTERS = 1_000_000
MAX_PREFERENCES_BYTES = 16 * 1024
# The cloud extension carries an upload in memory up to this; a longer take is split by the client.
MAX_RECORDING_BYTES = 100 * 1024 * 1024
# What the AI transcribes in one request (the framework's audio limit).
MAX_CAPTION_AUDIO_BYTES = 25 * 1024 * 1024
MAX_CLIP_BYTES = 2 * 1024 * 1024
MAX_AI_CHARACTERS = 50_000
BYTES_PER_MEGABYTE = 1024 * 1024
RECORDING_MIME_TYPES = ("video/webm", "video/mp4", "audio/webm", "audio/ogg", "audio/mp4")
CLIP_MIME_TYPES = ("audio/webm", "audio/ogg", "audio/wav", "audio/mp4", "audio/mpeg")
RECORDINGS_FOLDER = "recordings"
SERVER_KEPT_RECORDING_FIELDS = ("size_bytes", "storage_provider", "storage_path", "transcript", "caption_segments")

# A take's video and a voice clip are bodies the framework must not try to transcode
# (its content negotiation refuses any non-structured POST/PUT body with 415).
RECORDING_CONTENT_PATH = r"/v1/recording/[^/]+/content"
TRANSCRIBE_PATH = r"/v1/teleprompter/transcribe"
for _path in (RECORDING_CONTENT_PATH, TRANSCRIBE_PATH):
    skip_negotiation(_path)

AiAction = Literal["write", "shorten", "lengthen", "retone", "translate"]
CaptionFormat = Literal["vtt", "srt"]

SYSTEM_PROMPT = (
    "You edit scripts that people read aloud from a teleprompter. Answer with the script "
    "only, in Markdown, with no preamble or commentary. Keep sentences speakable: short, "
    "plain words, natural rhythm. Keep any text inside [square brackets] exactly as it "
    "is: those are cue notes for the presenter."
)
AI_INSTRUCTIONS: dict[str, str] = {
    "write": "Write a script from this brief.",
    "shorten": "Shorten this script by about a third, keeping every key point.",
    "lengthen": "Lengthen this script by about a third with relevant detail, keeping its voice.",
    "retone": "Rewrite this script in a {tone} tone, keeping its content.",
    "translate": "Translate this script into {language}, keeping its formatting.",
}


CUE_NOTE = re.compile(r"\[[^\]\n]*\]")
HEADING_MARK = re.compile(r"^#{1,6}\s+", re.MULTILINE)
EMPHASIS_MARK = re.compile(r"\*\*|==|[*_]")
SPOKEN = re.compile(r"[^\W_]")


def word_count(text: str | None) -> int:
    """Spoken words: cue notes, heading marks and emphasis markers left out, and only
    tokens with a letter or digit counted (the client counts the same way:
    client/src/features/prompter/script.ts spokenWordCount)."""
    plain = EMPHASIS_MARK.sub("", HEADING_MARK.sub(" ", CUE_NOTE.sub(" ", text or "")))
    return sum(1 for token in plain.split() if SPOKEN.search(token))


def _user_id(manager: AbstractBLLManager[Any]) -> str:
    return str(manager.requester.id)


def _require_team_sharing(manager: AbstractBLLManager[Any], team_id: Any) -> None:
    if team_id:
        require_feature(_user_id(manager), manager.model_registry, TEAM_SHARING)


class ScriptFolderModel(
    ApplicationModel,
    UpdateMixinModel,
    UserModel.Reference.Optional,
    TeamModel.Reference.Optional,
    metaclass=ModelMeta,
):
    Manager: ClassVar[type["ScriptFolderManager"]]
    name: str = Field(..., description="Folder name")

    table_comment: ClassVar[str] = "Folders scripts are filed in"

    class Create(BaseModel):
        name: str = Field(..., min_length=1, max_length=MAX_FOLDER_NAME)
        user_id: str | None = None
        team_id: str | None = None

    class Update(BaseModel):
        name: str | None = Field(None, min_length=1, max_length=MAX_FOLDER_NAME)
        team_id: str | None = None

    class Search(ApplicationModel.Search):
        name: StringSearchModel | None = None


class ScriptFolderManager(AbstractBLLManager[ScriptFolderModel], RouterMixin):
    _model = ScriptFolderModel

    def create(self, **kwargs: Any) -> Any:
        _require_team_sharing(self, kwargs.get("team_id"))
        return super().create(**kwargs)

    def update(self, id: str, **kwargs: Any) -> Any:
        _require_team_sharing(self, kwargs.get("team_id"))
        return super().update(id, **kwargs)


class ScriptModel(
    ApplicationModel,
    UpdateMixinModel,
    UserModel.Reference.Optional,
    TeamModel.Reference.Optional,
    ScriptFolderModel.Reference.Optional,
    metaclass=ModelMeta,
):
    Manager: ClassVar[type["ScriptManager"]]
    title: str = Field(..., description="Title")
    content: str = Field("", description="The script (Markdown; [brackets] are cue notes)")
    starred: bool = Field(False, description="Starred in the library")
    word_count: int = Field(0, description="Words in the content (kept by the server)")
    source_provider: str | None = Field(None, description="Where it was imported from (google_drive, file)")
    source_path: str | None = Field(None, description="The source's id or name there")

    table_comment: ClassVar[str] = "Teleprompter scripts"

    # word_count is set by the manager from the content; a value a client sends is replaced.
    class Create(BaseModel):
        title: str = Field(..., min_length=1, max_length=MAX_TITLE)
        content: str = Field("", max_length=MAX_SCRIPT_CHARACTERS)
        starred: bool = False
        word_count: int = 0
        script_folder_id: str | None = None
        source_provider: str | None = None
        source_path: str | None = None
        user_id: str | None = None
        team_id: str | None = None

    class Update(BaseModel):
        title: str | None = Field(None, min_length=1, max_length=MAX_TITLE)
        content: str | None = Field(None, max_length=MAX_SCRIPT_CHARACTERS)
        starred: bool | None = None
        word_count: int | None = None
        script_folder_id: str | None = None
        team_id: str | None = None

    class Search(ApplicationModel.Search, ScriptFolderModel.Reference.ID.Search):
        title: StringSearchModel | None = None


class ScriptManager(AbstractBLLManager[ScriptModel], RouterMixin):
    _model = ScriptModel

    def create(self, **kwargs: Any) -> Any:
        _require_team_sharing(self, kwargs.get("team_id"))
        return super().create(**{**kwargs, "word_count": word_count(kwargs.get("content"))})

    def update(self, id: str, **kwargs: Any) -> Any:
        _require_team_sharing(self, kwargs.get("team_id"))
        kwargs.pop("word_count", None)
        if kwargs.get("content") is not None:
            kwargs["word_count"] = word_count(kwargs["content"])
        return super().update(id, **kwargs)


class PrompterPreferenceModel(
    ApplicationModel,
    UpdateMixinModel,
    metaclass=ModelMeta,
):
    Manager: ClassVar[type["PrompterPreferenceManager"]]
    settings: dict[str, Any] = Field(default_factory=dict, description="Display and scroll settings")

    table_comment: ClassVar[str] = "Each user's prompter settings"

    class Create(BaseModel):
        settings: dict[str, Any] = Field(default_factory=dict)

    class Update(BaseModel):
        settings: dict[str, Any] | None = None

    class Search(ApplicationModel.Search):
        pass


def _checked_settings(settings: Any) -> None:
    if settings is not None and len(json.dumps(settings)) > MAX_PREFERENCES_BYTES:
        raise HTTPException(status_code=413, detail=f"Settings may be at most {MAX_PREFERENCES_BYTES} bytes")


class PrompterPreferenceManager(AbstractBLLManager[PrompterPreferenceModel], RouterMixin):
    _model = PrompterPreferenceModel

    def create(self, **kwargs: Any) -> Any:
        _checked_settings(kwargs.get("settings"))
        if self.list():
            raise HTTPException(status_code=409, detail="You already have prompter settings; update them")
        return super().create(**kwargs)

    def update(self, id: str, **kwargs: Any) -> Any:
        _checked_settings(kwargs.get("settings"))
        return super().update(id, **kwargs)


class RecordingModel(
    ApplicationModel,
    UpdateMixinModel,
    ScriptModel.Reference.Optional,
    metaclass=ModelMeta,
):
    Manager: ClassVar[type["RecordingManager"]]
    title: str = Field(..., description="Title")
    mime_type: str = Field(..., description="The video's type (video/webm, video/mp4, ...)")
    duration_seconds: float | None = Field(None, description="Length of the take")
    size_bytes: int = Field(0, description="Size of the stored video (kept by the server)")
    storage_provider: str | None = Field(None, description="The cloud provider holding the video")
    storage_path: str | None = Field(None, description="Its path there")
    transcript: str | None = Field(None, description="What was said, once captioned")
    caption_segments: list[dict[str, Any]] | None = Field(None, description="Timed segments, once captioned")

    table_comment: ClassVar[str] = "Recorded takes and their captions"

    class Create(BaseModel):
        title: str = Field(..., min_length=1, max_length=MAX_TITLE)
        mime_type: str
        duration_seconds: float | None = Field(None, ge=0)
        script_id: str | None = None

    # The storage and caption fields are kept by the manager; values a client sends are dropped.
    class Update(BaseModel):
        title: str | None = Field(None, min_length=1, max_length=MAX_TITLE)
        duration_seconds: float | None = Field(None, ge=0)
        size_bytes: int | None = None
        storage_provider: str | None = None
        storage_path: str | None = None
        transcript: str | None = None
        caption_segments: list[dict[str, Any]] | None = None

    class Search(ApplicationModel.Search, ScriptModel.Reference.ID.Search):
        title: StringSearchModel | None = None


class RecordingDeleted(ResponseModel):
    deleted: bool


class RecordingStored(ResponseModel):
    """The recording once its video is stored, shaped like the CRUD routes' answers."""

    recording: RecordingModel


class CaptionsRequest(ResponseModel):
    language: str | None = Field(None, max_length=16, description="The spoken language (ISO 639-1), if known")


class CaptionsResult(ResponseModel):
    transcript: str
    segments: int


def _cloud() -> Any:
    from zephyrex.extensions.cloud.EXT_Cloud import EXT_Cloud

    return EXT_Cloud


def _ai() -> Any:
    from zephyrex.extensions.ai.EXT_AI import EXT_AI

    return EXT_AI


def _extension_for(mime_type: str) -> str:
    return mime_type.split("/", 1)[1].split(";", 1)[0]


class RecordingManager(AbstractBLLManager[RecordingModel], RouterMixin):
    _model = RecordingModel
    # Deleting a recording deletes its video too, which is async: see delete_route.
    routes_to_register: ClassVar[list[RouteType] | None] = [
        RouteType.GET,
        RouteType.LIST,
        RouteType.CREATE,
        RouteType.UPDATE,
        RouteType.SEARCH,
    ]

    def create(self, **kwargs: Any) -> Any:
        require_feature(_user_id(self), self.model_registry, CLOUD_RECORDINGS)
        mime_type = str(kwargs.get("mime_type", "")).split(";", 1)[0]
        if mime_type not in RECORDING_MIME_TYPES:
            raise HTTPException(status_code=415, detail=f"A recording is one of {', '.join(RECORDING_MIME_TYPES)}")
        return super().create(**{**kwargs, "mime_type": mime_type})

    def update(self, id: str, **kwargs: Any) -> Any:
        for name in SERVER_KEPT_RECORDING_FIELDS:
            kwargs.pop(name, None)
        return super().update(id, **kwargs)

    def keep(self, id: str, **fields: Any) -> Any:
        """Write the fields the server keeps (storage, captions), which ``update`` refuses
        from clients."""
        unknown = set(fields) - set(SERVER_KEPT_RECORDING_FIELDS)
        if unknown:
            raise ValueError(f"keep() writes only server-kept fields, not {sorted(unknown)}")
        return super().update(id, **fields)

    def _mine(self, recording_id: str) -> Any:
        """The recording, as the requester may see it (404 otherwise)."""
        return self.get(id=recording_id)

    def _stored_bytes(self, excluding: str) -> int:
        stored = sum(int(r.size_bytes or 0) for r in self.list() or [] if str(r.id) != excluding)
        return stored

    @custom_route(
        method="PUT",
        path="/{id}/content",
        output_model=RecordingStored,
        authentication_type="jwt",
        expose_in=(ExposeIn.REST,),
        openapi_tags=("Recording",),
        summary="Store the take's video (the request body, of the recording's type)",
        raw_body=True,
    )
    async def content_put_route(self, request: Request, response: Response, id: str) -> RecordingStored:
        require_feature(_user_id(self), self.model_registry, CLOUD_RECORDINGS)
        recording = self._mine(id)
        content = await request.body()
        if not content:
            raise HTTPException(status_code=422, detail="The video is empty")
        if len(content) > MAX_RECORDING_BYTES:
            raise HTTPException(
                status_code=413,
                detail=f"A take may be at most {MAX_RECORDING_BYTES // BYTES_PER_MEGABYTE} MB",
            )
        total = self._stored_bytes(excluding=id) + len(content)
        require_within_limit(
            _user_id(self), self.model_registry, RECORDING_MEGABYTES, math.ceil(total / BYTES_PER_MEGABYTE)
        )
        path = f"{RECORDINGS_FOLDER}/{_user_id(self)}/{id}.{_extension_for(recording.mime_type)}"
        stored = await _cloud().upload_file(path, content, recording.storage_provider)
        updated = self.keep(
            id,
            size_bytes=len(content),
            storage_provider=stored["provider"],
            storage_path=stored["path"],
        )
        # The new version, as every write answers, so the client's next save names it.
        response.headers.update(etag_headers(updated.model_dump()))
        return RecordingStored(recording=updated)

    @custom_route(
        method="GET",
        path="/{id}/content",
        authentication_type="jwt",
        expose_in=(ExposeIn.REST,),
        response_class=Response,
        openapi_tags=("Recording",),
        summary="The take's video",
    )
    async def content_get_route(self, id: str) -> Response:
        recording = self._mine(id)
        if not recording.storage_path:
            raise HTTPException(status_code=404, detail="This recording has no video yet")
        content = await _cloud().download_file(recording.storage_provider, recording.storage_path)
        return Response(content=content, media_type=recording.mime_type, headers={"Cache-Control": "private"})

    @custom_route(
        method="DELETE",
        path="/{id}",
        output_model=RecordingDeleted,
        authentication_type="jwt",
        expose_in=(ExposeIn.REST,),
        openapi_tags=("Recording",),
        summary="Delete the recording and its video",
    )
    async def delete_route(self, id: str) -> RecordingDeleted:
        recording = self._mine(id)
        if recording.storage_path:
            await _cloud().delete_file(recording.storage_provider, recording.storage_path)
        self.delete(id=id)
        return RecordingDeleted(deleted=True)

    @custom_route(
        method="POST",
        path="/{id}/captions",
        input_model=CaptionsRequest,
        output_model=CaptionsResult,
        authentication_type="jwt",
        expose_in=(ExposeIn.REST,),
        openapi_tags=("Recording",),
        summary="Transcribe the take into captions",
    )
    async def captions_post_route(self, id: str, body: CaptionsRequest) -> CaptionsResult:
        require_feature(_user_id(self), self.model_registry, CAPTIONS)
        recording = self._mine(id)
        if not recording.storage_path:
            raise HTTPException(status_code=409, detail="Upload the take's video first")
        if int(recording.size_bytes or 0) > MAX_CAPTION_AUDIO_BYTES:
            raise HTTPException(
                status_code=413,
                detail=f"A take over {MAX_CAPTION_AUDIO_BYTES // BYTES_PER_MEGABYTE} MB is too long to caption",
            )
        content = await _cloud().download_file(recording.storage_provider, recording.storage_path)
        timed = await _ai().transcribe_timed(
            base64.b64encode(content).decode(),
            f"take.{_extension_for(recording.mime_type)}",
            body.language,
        )
        self.keep(id, transcript=timed["text"], caption_segments=timed["segments"])
        return CaptionsResult(transcript=timed["text"], segments=len(timed["segments"]))

    @custom_route(
        method="GET",
        path="/{id}/captions",
        authentication_type="jwt",
        expose_in=(ExposeIn.REST,),
        response_class=Response,
        openapi_tags=("Recording",),
        summary="The take's captions (format=vtt or srt)",
    )
    def captions_get_route(self, id: str, format: CaptionFormat = "vtt") -> Response:
        from zephyrex.extensions.ai.Captions import CONTENT_TYPES, render_captions

        recording = self._mine(id)
        if recording.caption_segments is None:
            raise HTTPException(status_code=404, detail="This take has no captions yet")
        return Response(
            content=render_captions(recording.caption_segments, format),
            media_type=CONTENT_TYPES[format],
            headers={"Content-Disposition": f'attachment; filename="{id}.{format}"'},
        )


class AiRequest(ResponseModel):
    action: AiAction
    content: str = Field(..., min_length=1, max_length=MAX_AI_CHARACTERS)
    tone: str | None = Field(None, max_length=60)
    language: str | None = Field(None, max_length=60)


class AiResult(ResponseModel):
    content: str


class Transcription(ResponseModel):
    text: str


def ai_messages(request: AiRequest) -> list[dict[str, str]]:
    """The chat for one AI action on a script."""
    if request.action == "retone" and not request.tone:
        raise HTTPException(status_code=422, detail="Name the tone to rewrite in")
    if request.action == "translate" and not request.language:
        raise HTTPException(status_code=422, detail="Name the language to translate into")
    instruction = AI_INSTRUCTIONS[request.action].format(tone=request.tone, language=request.language)
    return [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": f"{instruction}\n\n---\n\n{request.content}"},
    ]


class TeleprompterManager(AbstractBLLManager[Any], RouterMixin):
    prefix: ClassVar[str | None] = "/v1/teleprompter"
    tags: ClassVar[list[str] | None] = ["Teleprompter"]
    routes_to_register: ClassVar[list[RouteType] | None] = []

    @custom_route(
        method="POST",
        path="/ai",
        input_model=AiRequest,
        output_model=AiResult,
        authentication_type="jwt",
        expose_in=(ExposeIn.REST,),
        openapi_tags=("Teleprompter",),
        summary="Write, shorten, lengthen, retone or translate a script",
    )
    async def ai_route(self, body: AiRequest) -> AiResult:
        require_feature(_user_id(self), self.model_registry, AI_WRITER)
        answer = await _ai().chat(ai_messages(body), None, None, None, _user_id(self))
        content = str((answer.get("message") or {}).get("content") or "").strip()
        if not content:
            raise HTTPException(status_code=502, detail="The writer returned nothing; try again")
        return AiResult(content=content)

    @custom_route(
        method="POST",
        path="/transcribe",
        output_model=Transcription,
        authentication_type="jwt",
        expose_in=(ExposeIn.REST,),
        openapi_tags=("Teleprompter",),
        summary="The words in a short audio clip (voice-follow scrolling)",
        raw_body=True,
    )
    async def transcribe_route(self, request: Request, language: str | None = None) -> Transcription:
        require_feature(_user_id(self), self.model_registry, SERVER_VOICE)
        mime_type = request.headers.get("content-type", "").split(";", 1)[0]
        if mime_type not in CLIP_MIME_TYPES:
            raise HTTPException(status_code=415, detail=f"A clip is one of {', '.join(CLIP_MIME_TYPES)}")
        clip = await request.body()
        if not clip or len(clip) > MAX_CLIP_BYTES:
            raise HTTPException(
                status_code=413, detail=f"A clip is 1 byte to {MAX_CLIP_BYTES // BYTES_PER_MEGABYTE} MB"
            )
        heard = await _ai().transcribe(base64.b64encode(clip).decode(), f"clip.{_extension_for(mime_type)}", language)
        return Transcription(text=str(heard.get("text", "")))


def erase_teleprompter(user_id: str, model_registry: Any) -> None:
    """A deleted account's recordings go (their videos first), then its scripts, folders
    and settings. Runs before the account itself goes, through the privacy extension's
    eraser registry; safe to run twice."""
    from zephyrex.extensions.ExternalErrors import PermanentExternalError
    from zephyrex.logic.AbstractLogicManager.manager import _cache_sync_run

    root = str(env("ROOT_ID"))
    base = model_registry.DB.manager.Base
    # Scripts before the folders they are filed in; recordings before nothing, but first.
    for model in (RecordingModel, ScriptModel, ScriptFolderModel, PrompterPreferenceModel):
        db = model.DB(base)
        rows = (
            db.list(
                requester_id=root,
                model_registry=model_registry,
                filters=[db.created_by_user_id == user_id, db.deleted_at.is_(None)],
                return_type="dto",
                override_dto=model,
            )
            or []
        )
        for row in rows:
            if model is RecordingModel and row.storage_path:
                try:
                    _cache_sync_run(_cloud().delete_file(row.storage_provider, row.storage_path), timeout=None)
                except PermanentExternalError:
                    # Already gone (a re-run after a partial erase): nothing left to delete.
                    logger.warning("Erasing {}: {} was already gone", user_id, row.storage_path)
            db.delete(requester_id=root, model_registry=model_registry, filters=[db.id == row.id])


register_eraser("teleprompter", erase_teleprompter)
