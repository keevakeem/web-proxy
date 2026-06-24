export const config = { runtime: 'edge' };

export default async function handler(req) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const { searchParams } = new URL(req.url);
  const url = searchParams.get('url');

  if (!url) {
    return new Response(JSON.stringify({ error: 'url 파라미터가 필요해요' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    // 1. 페이지 fetch
    const pageRes = await fetch(decodeURIComponent(url), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9',
      }
    });
    const html = await pageRes.text();

    // 2. Claude API로 텍스트 추출
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': searchParams.get('key') || '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4000,
        messages: [{
          role: 'user',
          content: '아래 HTML에서 사용자에게 보이는 텍스트만 추출해줘. 메뉴, 버튼, 본문, 제목 등 실제 콘텐츠 텍스트만.\n\nJSON 배열만 반환. 설명 없이 순수 JSON만.\n형식: [{"tag":"h1","text":"..."},{"tag":"p","text":"..."}]\ntag는 h1/h2/h3/p/li 중 하나.\n\nHTML:\n' + html.slice(0, 80000)
        }]
      })
    });

    const claudeData = await claudeRes.json();
    const text = (claudeData.content && claudeData.content[0]) ? claudeData.content[0].text : '[]';
    const clean = text.replace(/```json|```/g, '').trim();
    const sections = JSON.parse(clean);

    return new Response(JSON.stringify({ sections }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch(e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}
