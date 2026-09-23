import React from 'react';
import {render,screen,fireEvent} from '@testing-library/react';
import {it,expect,vi} from 'vitest';
import ExportPreview from '../ExportPreview';
it('requires explicit acknowledgement before confirming a move',()=>{
  const confirm=vi.fn();render(<ExportPreview plan={{mode:'move',fileCount:1,operations:[{source:'/notes/a.md',destination:'/sorted/a.md',change:'Frontmatter updated',metadata:{before:'title: A',after:'title: A\ntags: Topic'}}]}} onCancel={()=>{}} onConfirm={confirm}/>);
  expect(screen.getByText('/sorted/a.md')).toBeInTheDocument();
  const button=screen.getByRole('button',{name:'Confirm move'});expect(button).toBeDisabled();
  fireEvent.click(screen.getByRole('checkbox'));fireEvent.click(button);expect(confirm).toHaveBeenCalledOnce();
});
it('cancel leaves the export uncommitted',()=>{
  const cancel=vi.fn(),confirm=vi.fn();render(<ExportPreview plan={{mode:'copy',fileCount:0,operations:[]}} onCancel={cancel} onConfirm={confirm}/>);
  fireEvent.click(screen.getByRole('button',{name:'Cancel'}));expect(cancel).toHaveBeenCalledOnce();expect(confirm).not.toHaveBeenCalled();
});
