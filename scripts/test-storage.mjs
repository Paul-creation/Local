// scripts/test-storage.mjs
async function main() {
  // Rust로 테스트
  const res = await fetch(
    'https://store.steampowered.com/api/appdetails?appids=252490&cc=kr&l=korean'
  );
  const json = await res.json();
  const data = json['252490']?.data;
  console.log('minimum 원문:', data?.pc_requirements?.minimum);
}

main();