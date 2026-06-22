import React from 'react';
import { Card, CardContent } from '@/components/ui/card';

export default function AssignedPrograms() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Assigned Programs</h1>
          <p className="text-muted-foreground">Programs assigned to you by the coach</p>
        </div>
      </div>
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          Mock Data Placeholder - Team Programs View
        </CardContent>
      </Card>
    </div>
  );
}
