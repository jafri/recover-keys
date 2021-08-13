const { JsonRpc, Numeric, Serialize } = require('@proton/js');
const fs = require('fs');

const rpc = new JsonRpc(['https://proton.greymass.com']);

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

const keyCounterByAccount = {};

const main = async () => {
  const credentials = await getCredentials();

  let newCreds = [];
  for (const cred of credentials) {
    const { accounts } = await rpc.get_accounts_by_authorizers([], [cred.key]);

    if (accounts && accounts.length) {
      const account = accounts[0];

      keyCounterByAccount[account.account_name] =
        (keyCounterByAccount[account.account_name] || 0) + 1;

      const key = Numeric.stringToPublicKey(cred.key);

      const dBuf = new Serialize.SerialBuffer({ array: key.data });
      const yBit = dBuf.get();
      const x = dBuf.getUint8Array(32);
      const userPresence = dBuf.get();
      const rpid = dBuf.getString();

      const ser = new Serialize.SerialBuffer();
      ser.push(yBit);
      ser.pushArray(x);
      const serializedKey = Serialize.arrayToHex(ser.asUint8Array());

      const keyExtension =
        keyCounterByAccount[account.account_name] > 1
          ? ` (${keyCounterByAccount[account.account_name]})`
          : '';

      newCreds.push({
        account: account.account_name,
        key_name: `${cred.key_name}${keyExtension}`,
        key: {
          key: ['ecc_public_key', serializedKey],
          user_presence: userPresence,
          rpid: rpid
        },
        credential_id: cred.credential_id
      });
    }
  }

  console.log('newCreds', newCreds);

  fs.writeFileSync('./creds2.json', JSON.stringify(newCreds, null, 4));
};

main();
