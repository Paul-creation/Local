async function main() {
  const res = await fetch(
    'https://store.steampowered.com/api/appdetails?appids=252490&cc=kr&l=korean'
  );
  const json = await res.json();
  const movies = json['252490']?.data?.movies;
  console.log(JSON.stringify(movies?.[0], null, 2));
}

main();