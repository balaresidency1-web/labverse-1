import React from 'react';
import { InventoryStatus } from '../../types';
import { AlertTriangle, XCircle } from 'lucide-react';

interface StatusBadgeProps {
  status: InventoryStatus | 'published' | 'draft' | 'active' | 'inactive' | 'suspended' | 'invited';
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs';

  switch (status) {
    case 'in_stock':
    case 'active':
      return (
        <span
          className={`inline-flex items-center gap-1 font-medium rounded-full bg-[#EBF5EE] text-[#2E6F4E] border border-[#C6E3D0] whitespace-nowrap ${sizeClasses}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[#2E6F4E] shrink-0" />
          {status === 'in_stock' ? 'In Stock' : 'Active'}
        </span>
      );

    case 'low_stock':
    case 'invited':
      return (
        <span
          className={`inline-flex items-center gap-1 font-medium rounded-full bg-[#FFFBEB] text-[#B45309] border border-[#FDE68A] whitespace-nowrap ${sizeClasses}`}
        >
          <AlertTriangle className="w-3 h-3 text-[#B45309] shrink-0" />
          {status === 'low_stock' ? 'Low Stock' : 'Invited'}
        </span>
      );

    case 'out_of_stock':
    case 'suspended':
    case 'inactive':
      return (
        <span
          className={`inline-flex items-center gap-1 font-medium rounded-full bg-[#FEF2F2] text-[#B91C1C] border border-[#FECACA] whitespace-nowrap ${sizeClasses}`}
        >
          <XCircle className="w-3 h-3 text-[#B91C1C] shrink-0" />
          {status === 'out_of_stock'
            ? 'Out of Stock'
            : status === 'suspended'
            ? 'Suspended'
            : 'Inactive'}
        </span>
      );

    case 'published':
      return (
        <span
          className={`inline-flex items-center gap-1 font-medium rounded-full bg-[#EBF5EE] text-[#2E6F4E] border border-[#C6E3D0] whitespace-nowrap ${sizeClasses}`}
        >
          Published
        </span>
      );

    case 'draft':
      return (
        <span
          className={`inline-flex items-center gap-1 font-medium rounded-full bg-[#FAF6F0] text-[#6E675F] border border-[#E7DDD0] whitespace-nowrap ${sizeClasses}`}
        >
          Draft
        </span>
      );

    default:
      return null;
  }
};
