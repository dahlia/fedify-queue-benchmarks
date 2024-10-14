import { AmqpMessageQueue } from "@fedify/amqp";
import {
  createFederation,
  importJwk,
  InProcessMessageQueue,
  MessageQueue,
  ParallelMessageQueue,
  Person,
} from "@fedify/fedify";
import { DenoKvMessageQueue, DenoKvStore } from "@fedify/fedify/x/denokv";
import { PostgresMessageQueue } from "@fedify/postgres";
import { RedisMessageQueue } from "@fedify/redis";
// @deno-types="npm:@types/amqplib@^0.10.5"
import amqplib from "amqplib";
import { Redis } from "ioredis";
import postgres from "postgres";
import "./logging.ts";

const parallel = parseInt(Deno.env.get("PARALLEL") ?? "1");
const noQueue = Deno.env.get("NO_QUEUE") === "1";
const inProcess = Deno.env.get("IN_PROCESS") === "1";
const redisUrl = Deno.env.get("REDIS_URL");
const pgUrl = Deno.env.get("PG_URL");
const amqpUrl = Deno.env.get("AMQP_URL");
const kv = await Deno.openKv(Deno.env.get("KV"));

export let queue: MessageQueue | undefined;
if (noQueue) {
  queue = undefined;
} else if (inProcess) {
  queue = new InProcessMessageQueue();
} else if (redisUrl != null) {
  queue = new RedisMessageQueue(() => new Redis(redisUrl), {
    channelKey: `fedify_bench_channel_${parallel ? "p" : "s"}`,
    lockKey: `fedify_bench_lock_${parallel ? "p" : "s"}`,
    queueKey: `fedify_bench_queue_${parallel ? "p" : "s"}`,
  });
} else if (pgUrl != null) {
  const pg = postgres(pgUrl);
  queue = new PostgresMessageQueue(pg);
} else if (amqpUrl != null) {
  const amqp = await amqplib.connect(amqpUrl);
  queue = new AmqpMessageQueue(amqp);
} else {
  queue = new DenoKvMessageQueue(kv);
}

if (queue != null && parallel > 1) {
  queue = new ParallelMessageQueue(queue, parallel);
}

export const federation = createFederation<void>({
  kv: new DenoKvStore(kv),
  queue,
  allowPrivateAddress: true,
  manuallyStartQueue: !inProcess,
});

const rsaPair: CryptoKeyPair = {
  privateKey: await importJwk({
    "kty": "RSA",
    "alg": "RS256",
    "n":
      "wQaxtrFw2DaLc-sGR8kHXCCGroCsX_jkwUH-oHAEtVIVZGWS9QoetEehXRqTvQdLO1LtMiG8EuXZu-TnE_IwDPplJ9YUiIp282ouYIkPCDhKko1U4-rMkYEGQN2Hl5qI8HqYLMhyjPuqOrk1WikygTgFROoPzcavcPhaDzdrpFudfdz4GB2L1VwJ1hvMiAI4QlpBw_DVp0WthEb3fUC0ruSYn790BlKXNqA7Nx-JiyKBICp32LYgsKYlZs7L55_6yqyesnvsWZEjgm8tZha9Qd2Ub61gZl5IZlwVV_U8C3nHw84za0LxS9epy-RnevPDwdlCW55xif4b8bbNq8LE_Pi0KIvpfsR407jiWccYD4S_b0G1aIOz0sN966_Eor_dEG3bxKCRuBollme1hhBL6adeeQafoiGhJl_39pKnMx6huRkKYxrAs7p2MM_TmLi-G3YmyeZVpagHR7R5s7Do3tWL35in9xXE0TBU-qym2Ts7iIhw6GwMqttdk3VfZqB6H0Xtjg5MTa_smTb39EwczrpChGrlM2SCmMIQ8XsBQrXcmZzZI6bEN9w-0evLjoNAO4NDnfsMm7NBAmsFXKhvaPCZ6rQkyu0DqLY-6ZOVITb4Jveos1m5kjTfxQ6Jkdgk8WSeBf6UPBCT01Kufq1gz4AZ2HNM1zj-36MWSjLTOB8",
    "e": "AQAB",
    "d":
      "rcyaPRY9teA-5iuq5v3h65i5y-u9yVgwmLYUT18tThnPeyteC9aF2OtaJpukhKJJoevD-MyZLCbbSqwLSFFb5IOciybeLCcIfZmQkok2CL-unZA17FXgxe53s_YDfYS-YlDwLfp58ekz2FYk7L6FZAYN8IQToMOR-lUTufm7qSx4fPh2RjhsTLrnfGphWeEtyMi9yHBT354EY0MG2jdluMfJiKT5EixRTPUu_C4gSS_TNiQm7vDmNEgVCyGORUstpEmTRsAACpF9eJckOHSnCeQ6H-frEaE47TliWmVMIEURkoNaluyamSBhGV3ZssJD84nsjtP2BTrQ7G4dd9cSR-YnyofFWD0kG3b1a8Gt_pfj6lk3Wt9q0nTfQrTKYMpFvEHDJtqVDVk2TrCIzGFsLuaEP9fGJxNq-05_lPb1FtiZlSyFBSUxKbvsy_uMDKWbRelUJG2Nr7NCjmLsRKLYBpiOJ_FtiKqOhTHZ67V9l9CCCKuxiOnkn4MzWDiwcNj4rgnM4A5L8ft6LSNhWyAK2BIs7h90bosAlOvPP3zeDsIEc7X6s7pxRLv66mJi1QhaNowMi_JMBnkYtN-BwVcf-o5E6sjpartiMAVGFeeps2VXGJzBonjl7y98rkj2vkLz2KeIzksaSC4ZDgBzK_KxHh3X0rmPWDRADGyeQhYuuJk",
    "p":
      "9rDj0b9RU9HjqyaySIw_R4ZdFX2cBfbFF7FRmGiiOJoYpREIFp3BjV4EHek0JyRdxYyjMtqq5pvV4cKymp_ODKA7j5y_F98N9H-_HGjPS8P5ueqaWrQ9KCTgPDXptVINP8FncANV1nuPSfnbWn0Q7JAIMAF3GuskNYBXFrB5DmIdM1FO52Q0bYnelPpn62K39NEY-gO5Ho47KSt_8sgCjlM4BrOCNyk_2Ni92gJp6wewxLc0U43ZqGprlnw1NEdE_WrZZ0cCeyQantK1e6PidiGXx_n86wPsrpl402Dc5XjcU06vmeBBsj3x8-Zl4pY3SVmz7mvI_qmuP-oV5-qN6w",
    "q":
      "yE9iu6Gz2iZfjpB2kzF764e3DNBrqSu2JZO-5tSfSm6EnN526PQ17oBzDZSCASJfrQjfvXzgYwYwCBbN3C03lraU4YIlIKDCdThJiQFs7gnDzKI7lwW-aVvUu4_1dOPbUD6NUHDWrXYbqiKdABXP1Fsf3vzKi6_ya9b7gwXGR_MX4R1j9SIQ7G8khAlYrSRpezSn5wc4lbkEiL50Jcsenm-ko0KL-l3XUZBVAiztRp_pXccJVeZujQJAC6bCbYJUx-_6vv5h90J3jmaSUq0f4sz7AvQL85Pa42xb3jFolPAeGBEoNT978rsnWF1PyiYmvsiBJRfQnMkZ7ECCRr_NnQ",
    "dp":
      "H09oOvDrY5YaLVjl--tBBNT674VXzjH55f3te0icfk6gniLBQg2XyVeLcjhtFCK7fB1TgVrbohVZWiQaAyIRRuz3YkzkvCTlYojsOrDazqT7ByvNl4GU2YmEpF-7X_YgFF15wW_K70QTdbIusxd4lG3bfCxTb6k0mU3Gv-x6EOdHCYJiX2AKf3SmOYZmtit7aak4YFMkpcornBgXTzsvh9zsGX2jI1kq71zjC86OnvQE7ZLLI2e3nnaTXTA6mH4LNZbgLQmIORTmBA5-VkkArzmoSAtknHeNDMQR39JFdyKV5ETyaLdb30GZefleKRojvj2SZsprYlcq9JXDXgIZLQ",
    "dq":
      "QALWa112Sv0-RiG2Mr16ez7oaSjlbq8wSvvW4o8JxFBjAno5B6Ka5XeYzLsrfE9Owc33KeeRETP1_2_CI10zyW7ZTuM3GCEnYyw0m5qgA8WNE4S4hD9qpOKarcGIT-1MtWz33b_hapc2qfzbrR5LRvJD0g94boEwd_PAdhNPVMjDVcX9nmVfgR7XTXZrJxFev-eIzFRLadUxNL2gAj_RrhHBTAbFEqIQX9k-wS44OPx7J-OmARRdOaSBcPe-ZB5lF2uB9qz2A3zzFceDdPYsHV8hy8TPWOxj449KIEwrvoSpKUm6TqHV6zCRlzRifhgJA6ixVHgyyxecuBm5SACdJQ",
    "qi":
      "O3CepoSRh-u7ZBIaRBlN2i4qs_GZu1wfAM2zijLPowO0T_lSsOWC2kZgl0eD_99n5iZKMvNjt6kXQ9EQH9j-lX5T80XxMezDchiElKEzSXF8FXD6D497JVlipzR4kRguBdPNOCYhrJGzeI1rozezPj-xXReeRoaIWbHYOCDX4t58Tw_FX3fte1ZJeej_-Tvze8NxlQu5LrxKrCM0OVVB_X6WLK1qgQ2rOXcusoBvsY8sFyyyheSHWclBnrCkz3rnVSEhjpKjHbWmSjRvbJI4djVBMPUSSKLYwTZtd04MTiwUoa0udst1yiXnYnKGbvostjxLTLZje5mqjQSOnOiSIg",
    "key_ops": ["sign"],
    "ext": true,
  }, "private"),
  publicKey: await importJwk({
    "kty": "RSA",
    "alg": "RS256",
    "n":
      "wQaxtrFw2DaLc-sGR8kHXCCGroCsX_jkwUH-oHAEtVIVZGWS9QoetEehXRqTvQdLO1LtMiG8EuXZu-TnE_IwDPplJ9YUiIp282ouYIkPCDhKko1U4-rMkYEGQN2Hl5qI8HqYLMhyjPuqOrk1WikygTgFROoPzcavcPhaDzdrpFudfdz4GB2L1VwJ1hvMiAI4QlpBw_DVp0WthEb3fUC0ruSYn790BlKXNqA7Nx-JiyKBICp32LYgsKYlZs7L55_6yqyesnvsWZEjgm8tZha9Qd2Ub61gZl5IZlwVV_U8C3nHw84za0LxS9epy-RnevPDwdlCW55xif4b8bbNq8LE_Pi0KIvpfsR407jiWccYD4S_b0G1aIOz0sN966_Eor_dEG3bxKCRuBollme1hhBL6adeeQafoiGhJl_39pKnMx6huRkKYxrAs7p2MM_TmLi-G3YmyeZVpagHR7R5s7Do3tWL35in9xXE0TBU-qym2Ts7iIhw6GwMqttdk3VfZqB6H0Xtjg5MTa_smTb39EwczrpChGrlM2SCmMIQ8XsBQrXcmZzZI6bEN9w-0evLjoNAO4NDnfsMm7NBAmsFXKhvaPCZ6rQkyu0DqLY-6ZOVITb4Jveos1m5kjTfxQ6Jkdgk8WSeBf6UPBCT01Kufq1gz4AZ2HNM1zj-36MWSjLTOB8",
    "e": "AQAB",
    "key_ops": ["verify"],
    "ext": true,
  }, "public"),
};

const ed25519Pair: CryptoKeyPair = {
  privateKey: await importJwk({
    "kty": "OKP",
    "crv": "Ed25519",
    "x": "ckeuKqNzihS-RmUz_EAGVF2zs_a3v_reU2LMUWY0UHw",
    "key_ops": ["sign"],
    "ext": true,
    "d": "RMeJbHRl7eus8pA1fEs1TOj2ouxQ0ok43D0EGRehubk",
  }, "private"),
  publicKey: await importJwk({
    "kty": "OKP",
    "crv": "Ed25519",
    "x": "ckeuKqNzihS-RmUz_EAGVF2zs_a3v_reU2LMUWY0UHw",
    "key_ops": ["verify"],
    "ext": true,
  }, "public"),
};

federation
  .setActorDispatcher("/users/{identifier}", async (ctx, identifier) => {
    if (identifier !== "bench") return null;
    const keyPairs = await ctx.getActorKeyPairs(identifier);
    return new Person({
      id: ctx.getActorUri(identifier),
      publicKey: keyPairs[0].cryptographicKey,
      assertionMethods: keyPairs.map((p) => p.multikey),
    });
  })
  .setKeyPairsDispatcher(() => [rsaPair, ed25519Pair]);

function fetch(request: Request) {
  return federation.fetch(request, { contextData: undefined });
}

if (Deno.env.get("WORKER") === "1") federation.startQueue();

export default { fetch };
