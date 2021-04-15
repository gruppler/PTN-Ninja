export default function read_dump(data, callback) {
  let spl = data.split("\nTABLE\n");
  let pos = read_csv(spl[0]);
  let games = read_csv(spl[1]);
  let moves = read_csv(spl[2]);
  let refs = read_csv(spl[3]);
  callback(pos, games, moves, refs);
}

function read_csv(data) {
  let csv = [];
  let lbreak = data.split("\n");
  lbreak.forEach((res) => {
    csv.push(res.split("\t"));
  });
  return csv;
}
