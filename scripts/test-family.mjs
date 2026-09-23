// scripts/test-family.mjs
async function main() {
  // Rust로 테스트
  const res = await fetch(
    'https://store.steampowered.com/api/appdetails?appids=252490&cc=kr&l=korean'
  );
  const json = await res.json();
  const categories = json['252490']?.data?.categories || [];
  console.log('카테고리 전체:', JSON.stringify(categories, null, 2));
}

main();