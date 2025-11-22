import React from 'react';
import { Star, StarOff } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export type GoogleDoc = {
  id: string;
  name: string;
  starred: boolean;
  modifiedTime: string;
  size: number;
};

export type DocumentListProps = {
  documents: GoogleDoc[];
  setSelectedDocument: (doc: GoogleDoc) => void;
};

export default function DocumentList({ documents, setSelectedDocument }: DocumentListProps) {
  return (
    <Card className='overflow-hidden'>
      <CardHeader className='pb-4'>
        <CardTitle className='text-lg'>Your Google Docs</CardTitle>
      </CardHeader>
      <CardContent className='p-0'>
        <div className='w-full overflow-x-auto'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Starred</TableHead>
                <TableHead>Modified</TableHead>
                <TableHead>Size</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {documents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className='text-center text-muted-foreground'>
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
                    <TableCell>
                      {doc.starred ? (
                        <Star className='h-5 w-5 text-primary' />
                      ) : (
                        <StarOff className='h-5 w-5 text-muted-foreground' />
                      )}
                    </TableCell>
                    <TableCell>{new Date(doc.modifiedTime).toLocaleString()}</TableCell>
                    <TableCell>{(doc.size / 1024).toFixed(2)} KB</TableCell>
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
