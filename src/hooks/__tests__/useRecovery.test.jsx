import {renderHook,act} from '@testing-library/react';
import {it,expect,vi,afterEach} from 'vitest';
import {useRecovery} from '../useRecovery';
const snapshot=JSON.stringify({files:[{path:'/a',name:'a',content:'text'}],clusters:[]});
const props={snapshot,project:{id:null,name:''},dirty:true,busy:false};
const setup=draft=>{
  vi.useFakeTimers();
  window.electronAPI={loadDraft:vi.fn().mockResolvedValue({success:true,draft}),saveDraft:vi.fn().mockResolvedValue({success:true}),clearDraft:vi.fn().mockResolvedValue({success:true})};
};
afterEach(()=>vi.useRealTimers());
it('debounces draft saves and saves only the latest edit',async()=>{
  setup(null);const {rerender}=renderHook(p=>useRecovery(p),{initialProps:props});
  await act(async()=>{});
  await act(async()=>{await vi.advanceTimersByTimeAsync(400);});
  rerender({...props,snapshot:snapshot.replace('text','latest')});
  await act(async()=>{await vi.advanceTimersByTimeAsync(800);});
  expect(window.electronAPI.saveDraft).toHaveBeenCalledTimes(1);
  expect(window.electronAPI.saveDraft.mock.calls[0][0].files[0].content).toBe('latest');
});
it('does not overwrite a previous-session draft before a recovery choice',async()=>{
  setup({data:JSON.parse(snapshot),updatedAt:'2026-09-19'});
  const {result}=renderHook(()=>useRecovery(props));await act(async()=>{});
  await act(async()=>{await vi.advanceTimersByTimeAsync(2000);});
  expect(result.current.pending).toBeTruthy();expect(window.electronAPI.saveDraft).not.toHaveBeenCalled();expect(window.electronAPI.clearDraft).not.toHaveBeenCalled();
});
it('flushes before a job and reports failed recovery writes without claiming success',async()=>{
  setup(null);const {result}=renderHook(()=>useRecovery(props));await act(async()=>{});
  window.electronAPI.saveDraft.mockResolvedValue({success:false,error:'Disk full'});
  await act(async()=>{await result.current.flush();});
  expect(result.current.status).toContain('Disk full');
});
