export const marker = (id) => `<!-- alo-roadmap:${id} -->`;
const START = '<!-- alo-roadmap-map:start -->';
const END = '<!-- alo-roadmap-map:end -->';

export function parseTickets(markdown) {
  const tickets = [], seen = new Set();
  for (const match of markdown.matchAll(/^### ([A-Z]\d+(?:\.\d+)?) (.+)$/gm)) {
    const id = match[1], title = match[2].trim();
    if (seen.has(id)) throw new Error(`Duplicate roadmap task ID ${id}`);
    seen.add(id); tickets.push({ id, title });
  }
  if (!tickets.length) throw new Error('No stable task headings found in the roadmap.');
  return tickets;
}

export function planLinks(tickets, mapping, issues, verified) {
  return tickets.map((ticket) => {
    if (!Object.hasOwn(mapping, ticket.id)) throw new Error(`Unmapped task ${ticket.id}; add an explicit map entry before import.`);
    const number = mapping[ticket.id];
    if (number === null) return { ...ticket, action: 'deferred', reason: 'Optional product/data-collection decision; no issue writes.' };
    if (!Number.isInteger(number) || number < 1) throw new Error(`Invalid issue map for ${ticket.id}`);
    const markerMatches = issues.filter((issue) => issue.body?.includes(marker(ticket.id)));
    const legacy = issues.filter((issue) => issue.title?.startsWith(`${ticket.id}:`));
    const candidates = [...new Map([...markerMatches, ...legacy].map((issue) => [issue.number, issue])).values()];
    if (candidates.length > 1 || candidates.some((issue) => issue.number !== number)) throw new Error(`${ticket.id} already appears on a different or duplicate issue; reconcile its map manually.`);
    const issue = issues.find((candidate) => candidate.number === number);
    if (verified && !issue) throw new Error(`Mapped issue #${number} for ${ticket.id} was not found; refusing to create a replacement.`);
    return { ...ticket, issue: number, state: issue?.state || 'unverified', action: issue?.body?.includes(marker(ticket.id)) ? 'already-linked' : 'link-existing' };
  });
}

export function linkedBody(body, tasks, repo) {
  body ||= '';
  const hasStart = body.includes(START), hasEnd = body.includes(END);
  if (body.split(START).length > 2 || body.split(END).length > 2 || hasStart !== hasEnd || (hasStart && body.indexOf(END) < body.indexOf(START))) throw new Error('Malformed managed roadmap block; refusing to overwrite the issue body.');
  const previous = hasStart ? body.slice(body.indexOf(START) + START.length, body.indexOf(END)).trim() : '### Linked roadmap tasks';
  const additions = tasks.filter((task) => !body.includes(marker(task.id))).map((task) => {
    const anchor = `${task.id} ${task.title}`.toLowerCase().replace(/[^\p{L}\p{N}_ -]/gu, '').replace(/ /g, '-');
    return `- [ ] ${marker(task.id)} [${task.id}: ${task.title}](https://github.com/${repo}/blob/main/docs/ROADMAP.md#${anchor})`;
  });
  if (!additions.length) return body;
  const block = `${START}\n${previous}\n${additions.join('\n')}\n${END}`;
  return hasStart ? body.slice(0, body.indexOf(START)) + block + body.slice(body.indexOf(END) + END.length) : `${body.trimEnd()}\n\n${block}`.trimStart();
}
