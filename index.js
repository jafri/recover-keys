const { JsonRpc } = require('@proton/js');
const fs = require('fs');

const rpc = new JsonRpc(['https://protontestnet.greymass.com/']);

const getCredentials = async lower_bound => {
  const { rows, more, next_key } = await rpc.get_table_rows({
    code: 'webauthn',
    scope: 'webauthn',
    table: 'credentials',
    limit: -1,
    lower_bound
  });

  if (more) {
    return rows.concat(await getCredentials(next_key));
  } else {
    return rows;
  }
};

const main = async () => {
  const credentials = await getCredentials();

  fs.writeFileSync('./creds.json', JSON.stringify(credentials, null, 4));
};

main();
