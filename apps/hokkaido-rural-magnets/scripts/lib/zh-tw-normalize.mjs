const WORD_REPLACEMENTS = [
  ['城市營造', '城鎮營造'],
  ['城市設計', '城鎮設計'],
  ['新城市', '新市鎮'],
  ['的城市', '的城鎮'],
  ['城市', '城鎮'],
  ['交流都市', '交流城鎮'],
  ['環境交流都會', '環境交流城鎮'],
  ['健康文化之城', '健康文化之市'],
  ['交流之城', '交流之鎮'],
  ['生態農業城', '生態農業鎮'],
  ['都市', '都會'],
  ['之城', '之鎮'],
  ['资源', '資源'],
  ['和谐', '和諧'],
  ['织梦', '織夢'],
  ['信息', '資訊'],
  ['软件', '軟體'],
  ['网络', '網路'],
  ['视频', '影片'],
  ['默认', '預設'],
  ['设置', '設定'],
  ['导出', '匯出'],
  ['导入', '匯入'],
  ['搜索', '搜尋'],
  ['地图', '地圖'],
  ['支持', '支援'],
  ['数据', '資料'],
  ['程序', '程式'],
  ['屏幕', '螢幕'],
  ['账号', '帳號'],
  ['登录', '登入'],
  ['邮箱', '電子郵件'],
  ['反馈', '意見回饋'],
  ['文件', '檔案'],
];

const CHAR_MAP = {
  国: '國',
  数: '數',
};

export function normalizeZhTwText(text) {
  if (!text) {
    return text;
  }

  const castleTownToken = '\uE000';
  let normalized = text.replaceAll('城下町', `${castleTownToken}下町`);

  for (const [from, to] of WORD_REPLACEMENTS) {
    normalized = normalized.split(from).join(to);
  }

  normalized = [...normalized]
    .map((character) => CHAR_MAP[character] ?? character)
    .join('');

  return normalized.replaceAll(`${castleTownToken}下町`, '城下町');
}
