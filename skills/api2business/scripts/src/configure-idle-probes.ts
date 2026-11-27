import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { isMap, isScalar, parseDocument } from 'yaml';
import { loadConfig } from '../../../../src/config';

export function configureIdleProbes(path: string, changesFile: string, confirm: boolean) {
  const source = readFileSync(path, 'utf8');
  const doc = parseDocument(source);
  const changes = JSON.parse(readFileSync(changesFile, 'utf8'));
  if (!changes || typeof changes !== 'object' || Array.isArray(changes) || !Object.keys(changes).length) throw new Error('expected scope-to-policy map');
  const edits: { start: number; end: number; text: string }[] = [];
  for (const [scope, value] of Object.entries(changes)) {
    const policy = value as {mode: string; enabled?: boolean};
    if (!policy || !['math','codex-custom','submit_sum'].includes(policy.mode) || Object.keys(policy).some(key => !['mode','enabled'].includes(key))) throw new Error('invalid probe policy');
    const base = ['operations','upstreamSchedulingV2','scopes',scope];
    const node = doc.getIn(base, true);
    if (!isMap(node) || !node.range) throw new Error(`unknown scope ${scope}`);
    const selector = doc.getIn([...base,'idleProbeMode'], true);
    if (isScalar(selector) && selector.range) edits.push({start:selector.range[0],end:selector.range[1],text:policy.mode});
    else {
      const start = node.range[0];
      const indent = source.slice(source.lastIndexOf('\n',start-1)+1,start);
      if (!/^ +$/u.test(indent)) throw new Error('expected block-style scope');
      edits.push({start,end:start,text:`idleProbeMode: ${policy.mode}\n${indent}`});
    }
    if (policy.enabled !== undefined) {
      const flag = doc.getIn([...base,'features','idleProbe'],true);
      if (typeof policy.enabled !== 'boolean' || !isScalar(flag) || !flag.range) throw new Error('invalid idleProbe switch');
      edits.push({start:flag.range[0],end:flag.range[1],text:String(policy.enabled)});
    }
  }
  let next = source;
  for (const edit of edits.sort((left,right)=>right.start-left.start)) next = next.slice(0,edit.start)+edit.text+next.slice(edit.end);
  const temporary = `${path}.${randomUUID()}.validate`;
  writeFileSync(temporary,next,{mode:0o600,flag:'wx'});
  try { loadConfig(temporary); } finally { unlinkSync(temporary); }
  if (confirm && next !== source) {
    if (readFileSync(path,'utf8') !== source) throw new Error('configuration changed during validation');
    writeFileSync(path,next);
  }
  return {ok:true,applied:confirm,changed:next!==source,scopes:Object.keys(changes),valuesPrinted:false};
}
