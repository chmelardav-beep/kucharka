// Serverová funkce: z odkazu (Instagram i recepty z webu) nebo vloženého textu udělá strukturovaný recept přes AI.
const MODEL = process.env.MODEL || 'claude-haiku-5-5';
const H = { 'content-type': 'application/json' };
const out = (s, b) => ({ statusCode: s, headers: H, body: JSON.stringify(b) });
const UA_BROWSER = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36';
const UA_FB = 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)';

const dec = s => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'")
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d));
const txt = v => typeof v === 'string' ? dec(v.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim() : '';

// --- recept ze strukturovaných dat stránky (schema.org/Recipe, mají ho téměř všechny receptové weby) ---
function walk(n, found) {
  if (!n || typeof n !== 'object') return;
  if (Array.isArray(n)) return n.forEach(x => walk(x, found));
  if ([].concat(n['@type'] || []).includes('Recipe')) found.push(n);
  if (n['@graph']) walk(n['@graph'], found);
}
function steps(v) {
  if (!v) return [];
  if (typeof v === 'string') return [txt(v)];
  if (Array.isArray(v)) return v.flatMap(steps);
  if (v.itemListElement) return steps(v.itemListElement);
  return [txt(v.text || v.name || '')];
}
function recipeText(r) {
  const y = [].concat(r.recipeYield || []).join(', ');
  return [
    `Název: ${txt(String(r.name || ''))}`, y && `Porce: ${y}`,
    r.totalTime && `Celkový čas: ${r.totalTime}`, r.prepTime && `Příprava: ${r.prepTime}`, r.cookTime && `Vaření: ${r.cookTime}`,
    'Suroviny:', ...[].concat(r.recipeIngredient || r.ingredients || []).map(x => '- ' + txt(String(x))),
    'Postup:', ...steps(r.recipeInstructions).filter(Boolean).map((s, i) => `${i + 1}. ${s}`)
  ].filter(Boolean).join('\n');
}
// záloha: viditelný text stránky, začíná okolo slova „suroviny“
function pageText(h) {
  const t = txt(h.replace(/<(script|style|noscript|svg|nav|header|footer|form|iframe)[\s\S]*?<\/\1>/gi, ' '));
  const i = t.search(/surovin/i), start = i > 300 ? i - 300 : 0;
  return t.slice(start, start + 7000);
}

async function meta(url) {
  const res = { title: '', desc: '', imageUrl: '', recipeText: '' };
  try {
    let host = ''; try { host = new URL(url).hostname; } catch {}
    const isIg = /(^|\.)instagram\.com$/i.test(host);
    const r = await fetch(url, {
      headers: { 'user-agent': isIg ? UA_FB : UA_BROWSER, 'accept-language': 'cs,en;q=0.8', accept: 'text/html,application/xhtml+xml' },
      redirect: 'follow', signal: AbortSignal.timeout(7000)
    });
    const h = await r.text();
    const g = p => {
      const m = h.match(new RegExp('<meta[^>]+(?:property|name)=["\']' + p + '["\'][^>]+content=["\']([^"\']*)["\']', 'i'))
        || h.match(new RegExp('<meta[^>]+content=["\']([^"\']*)["\'][^>]+(?:property|name)=["\']' + p + '["\']', 'i'));
      return m ? dec(m[1]) : '';
    };
    res.title = g('og:title'); res.desc = g('og:description') || g('description'); res.imageUrl = g('og:image');
    const found = [];
    for (const m of h.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
      try { walk(JSON.parse(m[1].trim()), found); } catch {}
    }
    if (found.length) {
      res.recipeText = recipeText(found[0]);
      if (!res.imageUrl) { const im = [].concat(found[0].image || [])[0]; res.imageUrl = typeof im === 'string' ? im : im?.url || ''; }
    } else if (!isIg) res.recipeText = pageText(h);
    if (res.imageUrl) res.imageUrl = new URL(res.imageUrl, url).href;
  } catch (e) { /* best effort */ }
  return res;
}
async function fetchImage(u) {
  if (!u) return '';
  try {
    const ir = await fetch(u, { headers: { 'user-agent': UA_BROWSER }, signal: AbortSignal.timeout(5000) });
    const buf = Buffer.from(await ir.arrayBuffer());
    if (ir.ok && buf.length < 1500000) return `data:${ir.headers.get('content-type') || 'image/jpeg'};base64,${buf.toString('base64')}`;
  } catch {}
  return '';
}

const SYS = `Extract a cooking recipe from the text (an Instagram caption, or text of a recipe web page). Write all values in Czech.
Return ONLY one JSON object, no markdown:
{"is_recipe":true|false,"title":"short name","servings":int,"active_time":minutes of hands-on work (int; estimate if missing; convert ISO durations like PT1H30M),"wait_time":minutes when the food prepares itself - baking, chilling, freezing, resting, rising (int, 0 if none),"wait_type":"pečení"|"chlazení"|"mražení"|"odpočinek"|"jiné"|null,
"meal":"snídaně"|"oběd"|"večeře"|"svačina"|"dezert","taste":"sladké"|"slané",
"diet":[subset of "vegetariánské","veganské","bez lepku" - only if clearly true],
"difficulty":"lehké"|"střední"|"náročné",
"ingredients":[{"name":"base form: singular nominative, lowercase, no quantity, e.g. 'vejce', 'kuřecí prsa', 'cibule'","amount":number|null,"unit":"g"|"ml"|"ks"|"lžíce"|"lžička"|"hrnek"|"stroužek"|"špetka"|null}],
"steps":["short step", ...]}
Unify synonyms (vajíčka -> vejce). Convert fractions to decimals. Ignore navigation, ads, comments and unrelated recipes. If the text is not a recipe or has no ingredients, return {"is_recipe":false}.`;

exports.handler = async event => {
  if (event.httpMethod !== 'POST') return out(405, { error: 'POST only' });
  if (process.env.APP_PASSWORD && event.headers['x-pass'] !== process.env.APP_PASSWORD) return out(401, { error: 'Špatné heslo (nastavení ⚙️)' });
  let b; try { b = JSON.parse(event.body || '{}'); } catch { return out(400, { error: 'Špatný požadavek' }); }
  let caption = (b.caption || '').trim();
  let imgP = Promise.resolve(''), title = '';
  if (b.url && (!caption || !b.image)) {
    const m = await meta(b.url);
    if (!b.image) imgP = fetchImage(m.imageUrl); // stahuje se souběžně s AI
    if (b.type === 'wood') title = m.title.slice(0, 80);
    if (!caption) caption = m.recipeText || m.desc;
  }
  const finish = async (s, body) => { const image = await imgP; return out(s, { ...body, ...(image ? { image } : {}), ...(title ? { title } : {}) }); };
  if (b.type === 'wood') return finish(200, {});
  if (!caption || caption.length < 30) return finish(422, { error: 'Nepodařilo se získat text receptu. Vlož ho ručně.' });
  const input = caption.slice(0, 9000);
  let t = '';
  try {
    if (process.env.GEMINI_API_KEY) {
      const models = [process.env.GEMINI_MODEL, 'gemini-3.8-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite']
        .filter((m, i, a) => m && a.indexOf(m) === i);
      let lastErr = '';
      for (const model of models) {
        for (let attempt = 0; attempt < 2 && !t; attempt++) {
          const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: SYS }] },
              contents: [{ role: 'user', parts: [{ text: input }] }],
              generationConfig: { responseMimeType: 'application/json', temperature: 0.2 }
            })
          });
          const j = await r.json().catch(() => ({}));
          if (r.ok) { t = (j.candidates?.[0]?.content?.parts || []).map(c => c.text || '').join(''); break; }
          lastErr = `${model}: ${j.error?.message || r.status}`;
          if (r.status === 503 || r.status === 429) await new Promise(res => setTimeout(res, 1500));
          else break;
        }
        if (t) break;
      }
      if (!t) return finish(502, { error: 'AI (Gemini) je teď nedostupná, zkus to za chvíli. ' + lastErr });
    } else {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: MODEL, max_tokens: 2500, system: SYS, messages: [{ role: 'user', content: input }] })
      });
      const j = await r.json();
      if (!r.ok) return finish(502, { error: 'AI: ' + (j.error?.message || r.status) });
      t = (j.content || []).map(c => c.text || '').join('');
    }
  } catch (e) { return finish(502, { error: 'AI nedostupná: ' + e.message }); }
  try {
    const rec = JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1));
    if (!rec.is_recipe || !rec.ingredients?.length) return finish(422, { error: 'V textu jsem nenašel recept. Vlož celý text receptu včetně surovin.' });
    return finish(200, { recipe: rec });
  } catch { return finish(502, { error: 'AI vrátila nečitelnou odpověď, zkus znovu.' }); }
};
