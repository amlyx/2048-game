#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <time.h>

#define SIZE 4

static uint64_t rng_state = 0x2026061602048ULL;
static uint16_t left_table[65536];
static uint16_t right_table[65536];

static inline uint64_t rng_u64(void) {
  uint64_t x = rng_state;
  x ^= x << 13;
  x ^= x >> 7;
  x ^= x << 17;
  rng_state = x;
  return x;
}

static inline uint32_t rng_mod(uint32_t n) {
  return (uint32_t)(rng_u64() % n);
}

static inline uint8_t nib(uint16_t row, int c) {
  return (uint8_t)((row >> (c * 4)) & 0xF);
}

static inline uint16_t put(uint16_t row, int c, uint8_t v) {
  return (uint16_t)(row | ((uint16_t)v << (c * 4)));
}

static uint16_t reverse_row(uint16_t row) {
  uint16_t out = 0;
  out = put(out, 0, nib(row, 3));
  out = put(out, 1, nib(row, 2));
  out = put(out, 2, nib(row, 1));
  out = put(out, 3, nib(row, 0));
  return out;
}

static uint16_t move_row_left(uint16_t row) {
  uint8_t vals[4];
  uint8_t count = 0;
  for (int c = 0; c < 4; c++) {
    uint8_t v = nib(row, c);
    if (v) vals[count++] = v;
  }

  uint8_t out_vals[4] = {0, 0, 0, 0};
  uint8_t out_count = 0;
  for (int i = 0; i < count; i++) {
    if (i + 1 < count && vals[i] == vals[i + 1]) {
      out_vals[out_count++] = vals[i] + 1;
      i++;
    } else {
      out_vals[out_count++] = vals[i];
    }
  }

  uint16_t out = 0;
  for (int c = 0; c < 4; c++) out = put(out, c, out_vals[c]);
  return out;
}

static void init_tables(void) {
  for (uint32_t row = 0; row < 65536; row++) {
    left_table[row] = move_row_left((uint16_t)row);
    right_table[row] = reverse_row(move_row_left(reverse_row((uint16_t)row)));
  }
}

static inline uint16_t get_col(const uint16_t rows[4], int c) {
  uint16_t col = 0;
  for (int r = 0; r < 4; r++) col = put(col, r, nib(rows[r], c));
  return col;
}

static inline void set_col(uint16_t rows[4], int c, uint16_t col) {
  for (int r = 0; r < 4; r++) {
    rows[r] = (uint16_t)((rows[r] & ~(0xFULL << (c * 4))) | ((uint16_t)nib(col, r) << (c * 4)));
  }
}

static void move_board(const uint16_t rows[4], int dir, uint16_t out[4]) {
  for (int r = 0; r < 4; r++) out[r] = rows[r];

  if (dir == 0 || dir == 1) {
    const uint16_t *table = dir == 0 ? left_table : right_table;
    for (int r = 0; r < 4; r++) out[r] = table[rows[r]];
  } else {
    const uint16_t *table = dir == 2 ? left_table : right_table;
    for (int c = 0; c < 4; c++) set_col(out, c, table[get_col(rows, c)]);
  }
}

static inline int same_board(const uint16_t a[4], const uint16_t b[4]) {
  return a[0] == b[0] && a[1] == b[1] && a[2] == b[2] && a[3] == b[3];
}

static void add_tile(uint16_t rows[4]) {
  uint8_t cells[16];
  uint8_t count = 0;
  for (int r = 0; r < 4; r++) {
    for (int c = 0; c < 4; c++) {
      if (nib(rows[r], c) == 0) cells[count++] = (uint8_t)(r * 4 + c);
    }
  }
  if (!count) return;

  uint8_t pos = cells[rng_mod(count)];
  uint8_t value = (rng_mod(10) == 0) ? 2 : 1;
  rows[pos / 4] = put(rows[pos / 4], pos % 4, value);
}

static uint32_t max_tile(const uint16_t rows[4]) {
  uint8_t max_exp = 0;
  for (int r = 0; r < 4; r++) {
    for (int c = 0; c < 4; c++) {
      uint8_t v = nib(rows[r], c);
      if (v > max_exp) max_exp = v;
    }
  }
  return max_exp ? (1U << max_exp) : 0;
}

static uint32_t play_one(void) {
  uint16_t rows[4] = {0, 0, 0, 0};
  add_tile(rows);
  add_tile(rows);

  while (1) {
    uint16_t nexts[4][4];
    uint8_t valid[4];
    uint8_t valid_count = 0;

    for (int d = 0; d < 4; d++) {
      move_board(rows, d, nexts[d]);
      if (!same_board(rows, nexts[d])) valid[valid_count++] = (uint8_t)d;
    }

    if (!valid_count) return max_tile(rows);

    uint8_t chosen = valid[rng_mod(valid_count)];
    for (int r = 0; r < 4; r++) rows[r] = nexts[chosen][r];
    add_tile(rows);
  }
}

int main(int argc, char **argv) {
  uint64_t games = argc > 1 ? strtoull(argv[1], NULL, 10) : 1000000ULL;
  init_tables();

  uint64_t ge512 = 0;
  uint64_t ge1024 = 0;
  uint64_t ge2048 = 0;
  uint64_t dist[4097] = {0};
  clock_t start = clock();

  for (uint64_t i = 0; i < games; i++) {
    uint32_t max = play_one();
    if (max <= 4096) dist[max]++;
    if (max >= 512) ge512++;
    if (max >= 1024) ge1024++;
    if (max >= 2048) ge2048++;
  }

  double secs = (double)(clock() - start) / CLOCKS_PER_SEC;
  printf("{\n");
  printf("  \"games\": %llu,\n", (unsigned long long)games);
  printf("  \"seconds\": %.3f,\n", secs);
  printf("  \"ge512\": %llu,\n", (unsigned long long)ge512);
  printf("  \"ge1024\": %llu,\n", (unsigned long long)ge1024);
  printf("  \"ge2048\": %llu,\n", (unsigned long long)ge2048);
  printf("  \"p512\": %.12g,\n", (double)ge512 / (double)games);
  printf("  \"p1024\": %.12g,\n", (double)ge1024 / (double)games);
  printf("  \"p2048\": %.12g,\n", (double)ge2048 / (double)games);
  printf("  \"distribution\": {\n");
  int first = 1;
  for (uint32_t v = 0; v <= 4096; v++) {
    if (dist[v]) {
      if (!first) printf(",\n");
      printf("    \"%u\": %llu", v, (unsigned long long)dist[v]);
      first = 0;
    }
  }
  printf("\n  }\n}\n");
  return 0;
}
