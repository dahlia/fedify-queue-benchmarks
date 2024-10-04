Benchmarks for [Fedify]'s outbox queue
====================================

This repository contains benchmarks for the outbox queue implementations in
[Fedify].  The comparison is between the following drivers:

 -  No queue
 -  [`InProcessMessageQueue`]
 -  [`DenoKvMessageQueue`]
 -  [`RedisMessageQueue`]
 -  [`PostgresMessageQueue`]

The benchmarks measure the time taken to process a batch of sending 500
activities to 100 recipients for each, which results in 50,000 messages
in total.

[Fedify]: https://fedify.dev/
[`InProcessMessageQueue`]: https://fedify.dev/manual/mq#inprocessmessagequeue
[`DenoKvMessageQueue`]: https://fedify.dev/manual/mq#denokvmessagequeue-deno-only
[`RedisMessageQueue`]: https://fedify.dev/manual/mq#redismessagequeue
[`PostgresMessageQueue`]: https://fedify.dev/manual/mq#postgresmessagequeue


Results
-------

Last update: October 4, 2024.

| Driver                            | Time taken to send[^1] | Time taken to receive[^2] |
| --------------------------------- | ---------------------: | ------------------------: |
| No queue                          | 214.39s                | 213.78s                   |
| [`InProcessMessageQueue`]         | 5.65s                  | 612.10s                   |
| [`DenoKvMessageQueue`]            | 7.04s                  | 1040.82s                  |
| [`RedisMessageQueue`]             | 7.29s                  | 971.46s                   |
| [`PostgresMessageQueue`]          | 12.18s                 | 800.47s                   |
| [`InProcessMessageQueue`] × 4[^3] | 6.02s                  | 239.56s                   |
| [`DenoKvMessageQueue`] × 4[^3]    | 6.96s                  | 949.76s                   |
| [`RedisMessageQueue`] × 4[^3]     | 7.40s                  | 1969.19s                  |
| [`PostgresMessageQueue`] × 4[^3]  | 11.46s                 | 266.86s                   |

No queue means that the entire process is done synchronously without any
message queue, hence it has the slowest response time.  However, if you want
the best throughput, you may consider using no queue.

The fastest response time is achieved by [`InProcessMessageQueue`], but it is
not recommended for production use because it is not persistent.  If you want
the best response time, you may consider using [`DenoKvMessageQueue`] on Deno,
or [`RedisMessageQueue`] (which is usable on Node.js, Bun, and Deno).

If you care about the response time but still want the best throughput, you may
consider using [`PostgresMessageQueue`] with [`ParallelMessageQueue`].
This setup has the slowest response time among the persistent message queues,
but it is still much faster than the synchronous process (no queue),
and it has the best throughput among the persistent message queues.

There are some curious results in the benchmarks.  For example, the throughput
of [`RedisMessageQueue`] is much worse when it is used with
[`ParallelMessageQueue`].  These should be further investigated in the future.

> [!NOTE]
> Although `InProcessMessageQueue` is included in the benchmarks and it has
> the fastest response time, it is not recommended for production use because
> it is not persistent.  It purposes to show the baseline performance of the
> message queue system.

[^1]: You can think of this as the response time of the API.  It does not
      include the time taken until the recipients receive the messages.
[^2]: You can think of this as the time taken until the recipients receive the
      messages.  It is measured from the first time the message is received by
      any recipient until the last time the message is received by any
      recipient.
[^3]: They are used together with [`ParallelMessageQueue`].

[`ParallelMessageQueue`]: https://fedify.dev/manual/mq#parallel-message-processing


Machine
-------

The benchmarks were run on a machine with the following specifications:

 -  CPU: AMD Ryzen 7 7700X (16) @ 5.573GHz
 -  RAM: 64 GiB
 -  OS: Fedora Linux 40 (Workstation Edition) x86_64
 -  Kernel: 6.10.11-200.fc40.x86_64


Software
--------

The software versions used in the benchmarks are:

 -  Deno 1.46.3
 -  Redis 7.2.5
 -  PostgreSQL 16.1
 -  [`jsr:@fedify/fedify` 1.0.2](https://github.com/dahlia/fedify/tree/1.0.2)
 -  [`jsr:@fedify/redis` 0.3.0](https://github.com/dahlia/fedify-redis/tree/0.3.0)
 -  [`jsr:@fedify/postgres` 0.1.0](https://github.com/dahlia/fedify-postgres/tree/0.1.0)
 -  [`npm:ioredis` 5.4.1](https://github.com/redis/ioredis/tree/v5.4.1)
 -  [`npm:postgres` 3.4.4](https://github.com/porsager/postgres/tree/v3.4.4)


How to run the benchmarks on your machine
-----------------------------------------

### Prerequisites

You need to have the following software installed:

 -  [Deno]
 -  [Redis]
 -  [PostgreSQL]

[Deno]: https://deno.land/
[Redis]: https://redis.io/
[PostgreSQL]: https://www.postgresql.org/

### Redis

You need to have a Redis server running on `localhost:6379`.

### PostgreSQL

You need to set up a PostgreSQL database that can be accessed by the following
database URL:

~~~~
postgresql://localhost:5432/fedify_bench
~~~~

### Run the benchmarks

You can run the benchmarks by executing the following command:

~~~~ bash
deno task bench
~~~~

It takes from several minutes to few hours to complete the benchmarks depending
on your machine's performance.

If you decrease or increase the number of activities to send, you can specify
the number of activities as environment variable `TOTAL`:

~~~~ bash
TOTAL=1000 deno task bench
~~~~

If you decrease or increase the number of recipients, you can specify the number
of recipients as environment variable `RECIPIENTS`:

~~~~ bash
RECIPIENTS=50 deno task bench
~~~~
