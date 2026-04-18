'use client';

import { useState, useCallback, useMemo } from 'react';

export type FilterType = 'text' | 'select' | 'date' | 'boolean';

export interface ColumnFilter {
  id: string;
  value: any;
  type: FilterType;
}

export function useTableFilters() {
  const [filters, setFilters] = useState<Record<string, ColumnFilter>>({});

  const setFilter = useCallback((columnId: string, value: any, type: FilterType = 'text') => {
    setFilters(prev => {
      // If value is empty/null, remove the filter
      if (value === '' || value === null || value === undefined || (Array.isArray(value) && value.length === 0)) {
        const { [columnId]: _, ...rest } = prev;
        return rest;
      }
      return {
        ...prev,
        [columnId]: { id: columnId, value, type }
      };
    });
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({});
  }, []);

  const hasFilters = useMemo(() => Object.keys(filters).length > 0, [filters]);

  // Serializza i filtri per le API (es. filter_role=admin)
  const getApiParams = useCallback(() => {
    const params: Record<string, string> = {};
    Object.entries(filters).forEach(([id, filter]) => {
      if (filter.value !== undefined && filter.value !== null && filter.value !== '') {
        params[`filter_${id}`] = String(filter.value);
      }
    });
    return params;
  }, [filters]);

  return {
    filters,
    setFilter,
    clearFilters,
    hasFilters,
    getApiParams
  };
}
