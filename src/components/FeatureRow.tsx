import React from 'react';
import { CheckCircle2 } from 'lucide-react';

const FeatureRow: React.FC<{ title: string, desc: string }> = ({ title, desc }) => (
  <div className="flex gap-4">
    <div className="mt-1">
      <div className="w-6 h-6 rounded-full bg-grove/20 flex items-center justify-center">
        <CheckCircle2 className="w-4 h-4 text-grove" />
      </div>
    </div>
    <div>
      <h4 className="font-bold text-ink">{title}</h4>
      <p className="text-ink-light text-sm">{desc}</p>
    </div>
  </div>
);

export default FeatureRow;
