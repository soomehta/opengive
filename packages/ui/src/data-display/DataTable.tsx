'use client';

import * as React from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SortDirection = 'asc' | 'desc';

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  align?: 'start' | 'end';
  mono?: boolean;
  sortable?: boolean;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  /** Called when the user clicks "Load More" */
  onLoadMore?: () => void;
  hasMore?: boolean;
  isLoading?: boolean;
  /** Optional accessible label for the table */
  caption?: string;
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  onLoadMore,
  hasMore = false,
  isLoading = false,
  caption,
  className,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = React.useState<string | null>(null);
  const [sortDir, setSortDir] = React.useState<SortDirection>('asc');

  function handleSort(key: string) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  const sortedData = React.useMemo(() => {
    if (!sortKey) return data;
    return [...data].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (aVal === bVal) return 0;
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;
      const cmp =
        typeof aVal === 'number' && typeof bVal === 'number'
          ? aVal - bVal
          : String(aVal).localeCompare(String(bVal));
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [data, sortKey, sortDir]);

  return (
    <div
      className={className}
      style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}
    >
      <div
        style={{
          overflowX: 'auto',
          overflowY: 'auto',
          maxHeight: '100%',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: 'var(--text-sm)',
            fontFamily: 'var(--font-body)',
            tableLayout: 'auto',
          }}
          aria-label={caption}
        >
          {caption && (
            <caption
              style={{
                position: 'absolute',
                width: '1px',
                height: '1px',
                overflow: 'hidden',
                clip: 'rect(0,0,0,0)',
                whiteSpace: 'nowrap',
              }}
            >
              {caption}
            </caption>
          )}

          {/* Sticky header */}
          <thead
            style={{
              position: 'sticky',
              top: 0,
              zIndex: 1,
              backgroundColor: 'var(--surface-overlay)',
            }}
          >
            <tr>
              {columns.map((col) => {
                const isSorted = sortKey === col.key;
                const canSort = col.sortable !== false;
                return (
                  <th
                    key={col.key}
                    scope="col"
                    aria-sort={
                      isSorted
                        ? sortDir === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : undefined
                    }
                    style={{
                      padding: '0.75rem 1rem',
                      textAlign: col.align === 'end' ? 'right' : 'left',
                      fontWeight: 500,
                      color: 'var(--text-tertiary)',
                      borderBottom: '1px solid var(--border-subtle)',
                      whiteSpace: 'nowrap',
                      userSelect: 'none',
                      cursor: canSort ? 'pointer' : 'default',
                      backgroundColor: 'transparent',
                    }}
                    onClick={canSort ? () => handleSort(col.key) : undefined}
                    onKeyDown={
                      canSort
                        ? (e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              handleSort(col.key);
                            }
                          }
                        : undefined
                    }
                    tabIndex={canSort ? 0 : undefined}
                    role={canSort ? 'button' : undefined}
                  >
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        color: isSorted
                          ? 'var(--text-primary)'
                          : 'var(--text-tertiary)',
                      }}
                    >
                      {col.header}
                      {canSort && (
                        <svg
                          width="10"
                          height="10"
                          viewBox="0 0 10 10"
                          fill="none"
                          aria-hidden="true"
                          style={{
                            opacity: isSorted ? 1 : 0.4,
                            transform:
                              isSorted && sortDir === 'desc'
                                ? 'rotate(180deg)'
                                : 'none',
                            transition: 'transform 150ms ease',
                          }}
                        >
                          <path
                            d="M5 2L8 6H2L5 2Z"
                            fill="currentColor"
                          />
                        </svg>
                      )}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>

          {/* Body */}
          <tbody>
            {sortedData.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  style={{
                    padding: '2rem',
                    textAlign: 'center',
                    color: 'var(--text-tertiary)',
                    fontStyle: 'italic',
                  }}
                >
                  No data available
                </td>
              </tr>
            ) : (
              sortedData.map((row, rowIndex) => (
                <tr
                  key={rowIndex}
                  style={{
                    backgroundColor:
                      rowIndex % 2 === 0
                        ? 'var(--surface-raised)'
                        : 'var(--surface-base)',
                    transition: 'background-color var(--transition-fast)',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLTableRowElement).style.backgroundColor =
                      'var(--surface-elevated)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLTableRowElement).style.backgroundColor =
                      rowIndex % 2 === 0
                        ? 'var(--surface-raised)'
                        : 'var(--surface-base)';
                  }}
                >
                  {columns.map((col) => {
                    const rawValue = row[col.key];
                    const displayValue = col.render
                      ? col.render(row)
                      : rawValue !== null && rawValue !== undefined
                        ? String(rawValue)
                        : '—';

                    return (
                      <td
                        key={col.key}
                        style={{
                          padding: '0.75rem 1rem',
                          textAlign: col.align === 'end' ? 'right' : 'left',
                          color: 'var(--text-primary)',
                          borderBottom: '1px solid var(--border-subtle)',
                          fontFamily: col.mono
                            ? 'var(--font-mono)'
                            : 'var(--font-body)',
                          fontVariantNumeric: col.mono ? 'tabular-nums' : undefined,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {displayValue}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Load More */}
      {(hasMore || isLoading) && (
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <button
            type="button"
            onClick={onLoadMore}
            disabled={isLoading}
            style={{
              padding: '0.5rem 1.5rem',
              fontSize: 'var(--text-sm)',
              fontFamily: 'var(--font-body)',
              color: isLoading ? 'var(--text-tertiary)' : 'var(--accent-trust)',
              backgroundColor: 'transparent',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-md)',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              transition: 'all var(--transition-fast)',
            }}
          >
            {isLoading ? 'Loading…' : 'Load More'}
          </button>
        </div>
      )}
    </div>
  );
}
