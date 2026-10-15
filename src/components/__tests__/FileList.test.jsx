import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import FileList from '../FileList';

const mockFiles = [
  { name: 'file1.md', path: '/path/file1.md', content: '# Heading 1\nSome content.', size: 1024, modified: new Date() },
  { name: 'file2.md', path: '/path/file2.md', content: 'Content 2', size: 2048 },
  { name: 'file3.md', path: '/path/file3.md', content: 'Content 3', size: 3072 },
  { name: 'file4.md', path: '/path/file4.md', content: 'Content 4', size: 4096 }
];

vi.mock('react-virtualized-auto-sizer', () => ({
  AutoSizer: ({ renderProp }) => <div data-testid="autosizer">{renderProp({ height: 800, width: 1200 })}</div>
}));

describe('FileList Virtualization', () => {

  it('renders files correctly with virtualization width', () => {
    const handleRemove = vi.fn();
    render(<FileList files={mockFiles} onRemove={handleRemove} />);
    
    expect(screen.getByText('file1.md')).toBeInTheDocument();
    expect(screen.getByText('file2.md')).toBeInTheDocument();
    expect(screen.getByText('file3.md')).toBeInTheDocument();
    expect(screen.getByText('file4.md')).toBeInTheDocument();
  });

  it('calls onRemove when remove button is clicked', () => {
    const handleRemove = vi.fn();
    render(<FileList files={mockFiles} onRemove={handleRemove} />);
    
    const removeButtons = screen.getAllByRole('button', { name: /Remove file1.md/i });
    if(removeButtons.length > 0) {
        fireEvent.click(removeButtons[0]);
        expect(handleRemove).toHaveBeenCalledWith(0);
    }
  });

  it('expands preview when a file is clicked', () => {
    const handleRemove = vi.fn();
    render(<FileList files={mockFiles} onRemove={handleRemove} />);
    
    const fileCard = screen.getByText('file1.md').closest('.file-card');
    
    fireEvent.click(fileCard);
    
    const preTags = document.querySelectorAll('pre');
    expect(preTags.length).toBeGreaterThan(0);
  });

  it('selects files with ctrl+click and offers document merge in that order', () => {
    const handleRemove = vi.fn();
    const handleMerge = vi.fn().mockResolvedValue(false);
    render(<FileList files={mockFiles} onRemove={handleRemove} onMergeDocuments={handleMerge} />);

    fireEvent.click(screen.getByText('file2.md').closest('.file-card'), { ctrlKey: true });
    fireEvent.click(screen.getByText('file1.md').closest('.file-card'), { ctrlKey: true });

    const mergeButton = screen.getByRole('button', { name: /Merge 2 into one document/i });
    fireEvent.click(mergeButton);
    expect(handleMerge).toHaveBeenCalledWith([1, 0]);
  });
});
