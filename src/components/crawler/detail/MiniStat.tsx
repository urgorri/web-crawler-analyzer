'use client';

import * as React from 'react';
import { Card, CardContent } from '@/components/ui/card';

interface MiniStatProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}

export function MiniStat({ icon, label, value }: MiniStatProps) {
  return (
    <Card className="py-4">
      <CardContent className="flex items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-lg bg-muted">
          {icon}
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="font-semibold tabular-nums">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
