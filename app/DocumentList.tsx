import React from 'react';
import { Star, StarOff } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DocumentDescriptor } from '@/lib/documents';

export type DocumentListProps = {
  title: string;
  documents: DocumentDescriptor[];
  setSelectedDocument: (doc: DocumentDescriptor) => void;
};

export default function DocumentList({ title, documents, setSelectedDocument }: DocumentListProps) {
  return (
    <Card className='overflow-hidden'>
      <CardHeader className='pb-4'>
        <CardTitle className='text-lg'>{title}</CardTitle>
      </CardHeader>
      <CardContent className='p-0'>
        <div className='w-full overflow-x-auto'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Starred</TableHead>
                <TableHead>Modified</TableHead>
                <TableHead>Size</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {documents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className='text-center text-muted-foreground'>
                    No documents available yet.
                  </TableCell>
                </TableRow>
              ) : (
                documents.map((doc) => (
                  <TableRow
                    key={doc.id}
                    className='cursor-pointer hover:bg-muted/50'
                    onClick={() => setSelectedDocument(doc)}
                  >
                    <TableCell className='font-medium'>{doc.name}</TableCell>
                    <TableCell className='uppercase text-muted-foreground'>{doc.provider}</TableCell>
                    <TableCell>
                      {doc.starred ? (
                        <Star className='h-5 w-5 text-primary' />
                      ) : (
                        <StarOff className='h-5 w-5 text-muted-foreground' />
                      )}
                    </TableCell>
                    <TableCell>
                      {doc.modifiedTime ? new Date(doc.modifiedTime).toLocaleString() : 'Unknown'}
                    </TableCell>
                    <TableCell>
                      {typeof doc.size === 'number' ? `${(doc.size / 1024).toFixed(2)} KB` : 'N/A'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
