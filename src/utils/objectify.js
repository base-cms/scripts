module.exports = (rows = []) => {
  const headers = rows.slice(0, 1).pop();
  return rows.slice(1).map((row) => ({
    ...(headers[0] && { [headers[0]]: `${row[0]}`.trim() }),
    ...(headers[1] && { [headers[1]]: `${row[1]}`.trim() }),
    ...(headers[2] && { [headers[2]]: `${row[2]}`.trim() }),
    ...(headers[3] && { [headers[3]]: `${row[3]}`.trim() }),
    ...(headers[4] && { [headers[4]]: `${row[4]}`.trim() }),
    ...(headers[5] && { [headers[5]]: `${row[5]}`.trim() }),
  }));
};
