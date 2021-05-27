import {
  VariableBlob,
  SubmitBlockRequest,
  SubmitBlockRequestLike,
  Multihash,
} from "koinos-types2";
import * as crypto from "crypto";
import * as secp256k1 from "secp256k1";
import * as amqp from "amqplib/callback_api";

function recover(signatureRec: VariableBlob, hash: Multihash): Uint8Array {
  const recid = signatureRec.buffer[0] >> 5;
  const signature = signatureRec.buffer.slice(1);
  return secp256k1.ecdsaRecover(signature, recid, hash.digest.buffer, true);
}

const seed = "test seed";
const privKey = crypto.createHash("sha256").update(seed).digest();
secp256k1.privateKeyVerify(privKey);
const pubKey = secp256k1.publicKeyCreate(privKey);
console.log(`private key: ${privKey.toString("hex")}`);
console.log(`public key: ${Buffer.from(pubKey).toString("hex")}`);

amqp.connect("amqp://guest:guest@localhost:5672/", (error0, connection) => {
  if (error0) throw error0;

  connection.createChannel((error1, channel) => {
    const queue = "koinos.rpc.chain";
    channel.assertQueue(queue, {
      durable: true,
    });

    console.log(`Waiting for messages in ${queue}. To exit press CTRL+C`);
    channel.consume(
      queue,
      (msg) => {
        const { type, value } = JSON.parse(msg.content.toString()) as {
          type: string;
          value: unknown;
        };
        if (type === "koinos::rpc::chain::submit_block_request") {
          const { block } = new SubmitBlockRequest(
            value as SubmitBlockRequestLike
          );
          const signer = recover(block.signatureData, block.id);
          console.log(`\nBlock height: ${block.header.height.toString()}`);
          console.log(
            `Number of transactions: ${block.transactions.items.length}`
          );
          console.log(`Signed by: ${Buffer.from(signer).toString("hex")}`);
        }
      },
      {
        noAck: true,
      }
    );
  });
});
