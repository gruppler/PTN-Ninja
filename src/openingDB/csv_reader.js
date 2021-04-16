export default function read_dump(data, callback) {
  let spl = data.split("\nTABLE\n");
  let pos = read_csv(spl[0]);
  let games = read_csv_games(spl[1]);
  let moves = read_csv(spl[2]);
  let refs = read_csv(spl[3]);
  callback(pos, games, moves, refs);
}

function read_csv_games(data) {
  data = data.replaceAll('"[', "[");
  data = data.replaceAll('\n\n\n"', "");
  data = data.replaceAll('""', '"');
  let csv = [];
  let row = [];
  let entries = data.split("\t");

  entries.forEach((res) => {
    if (row.length == 8) {
      let spl = res.split("\n");
      row.push(spl[0]);
      csv.push(row);
      row = [];
      row.push(spl[1]);
    } else {
      row.push(res);
    }
  });
  return csv;
}

function read_csv(data) {
  let csv = [];
  let lbreak = data.split("\n");
  lbreak.forEach((res) => {
    csv.push(res.split("\t"));
  });
  return csv;
}
