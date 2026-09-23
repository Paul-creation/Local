// scripts/test-spec.mjs
async function main() {
  const res = await fetch(
    'https://store.steampowered.com/api/appdetails?appids=252490&cc=kr&l=korean'
  );
  const json = await res.json();
  const data = json['252490']?.data;
  console.log('minimum 원문:');
  console.log(data?.pc_requirements?.minimum);
  console.log('\nrecommended 원문:');
  console.log(data?.pc_requirements?.recommended);
}

main();