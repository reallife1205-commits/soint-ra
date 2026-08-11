export async function POST(req) {
  const { address } = await req.json();

  if (!address) {
    return Response.json({ error: "주소가 필요해요" }, { status: 400 });
  }

  const kakaoKey = process.env.KAKAO_REST_API_KEY;
  if (!kakaoKey) {
    return Response.json(
      { error: "카카오 API 키가 설정되지 않았어요" },
      { status: 500 }
    );
  }

  try {
    const res = await fetch(
      `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(
        address
      )}`,
      {
        headers: { Authorization: `KakaoAK ${kakaoKey}` },
      }
    );
    const data = await res.json();

    if (!data.documents || data.documents.length === 0) {
      return Response.json(
        { error: "해당 주소를 찾을 수 없어요" },
        { status: 404 }
      );
    }

    const doc = data.documents[0];
    return Response.json({
      lat: parseFloat(doc.y),
      lon: parseFloat(doc.x),
      matched_address: doc.address_name,
    });
  } catch (e) {
    return Response.json({ error: "좌표 변환에 실패했어요" }, { status: 500 });
  }
}
