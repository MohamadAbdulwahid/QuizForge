-- Initial schema migration (singular table names, reserved name fixed -> app_user)

CREATE TABLE app_user (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  email varchar(255) NOT NULL UNIQUE,
  username varchar(50) NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE quiz (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  title varchar(50) NOT NULL,
  description varchar(255),
  creator_id bigint NOT NULL,
  share_code varchar(6),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_creator_id FOREIGN KEY (creator_id) REFERENCES app_user(id) ON DELETE CASCADE
);

CREATE TABLE question (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  quiz_id bigint NOT NULL,
  text varchar(255) NOT NULL,
  type varchar(255) NOT NULL,
  options jsonb NOT NULL,
  correct_answer varchar(255),
  time_limit int,
  points int NOT NULL DEFAULT 0,
  order_index int NOT NULL,
  CONSTRAINT fk_question_quiz FOREIGN KEY (quiz_id) REFERENCES quiz(id) ON DELETE CASCADE
);

CREATE TABLE session (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  quiz_id bigint NOT NULL,
  pin varchar(8) NOT NULL,
  status varchar(50) NOT NULL DEFAULT 'pending',
  host_id bigint NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_session_quiz FOREIGN KEY (quiz_id) REFERENCES quiz(id) ON DELETE CASCADE,
  CONSTRAINT fk_session_host FOREIGN KEY (host_id) REFERENCES app_user(id) ON DELETE CASCADE
);

CREATE TABLE session_player (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  session_id bigint NOT NULL,
  user_id bigint NOT NULL,
  username varchar(50) NOT NULL,
  score int NOT NULL DEFAULT 0,
  lives int,
  status varchar(50) NOT NULL DEFAULT 'active',
  CONSTRAINT fk_sp_session FOREIGN KEY (session_id) REFERENCES session(id) ON DELETE CASCADE,
  CONSTRAINT fk_sp_user FOREIGN KEY (user_id) REFERENCES app_user(id) ON DELETE CASCADE
);

CREATE TABLE game_event (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  session_id bigint NOT NULL,
  session_player_id bigint,
  event_type varchar(100) NOT NULL,
  data jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_ge_session FOREIGN KEY (session_id) REFERENCES session(id) ON DELETE CASCADE,
  CONSTRAINT fk_ge_session_player FOREIGN KEY (session_player_id) REFERENCES session_player(id) ON DELETE SET NULL
);

CREATE TABLE player_stat (
  user_id bigint PRIMARY KEY,
  mode varchar(50) NOT NULL,
  wins int NOT NULL DEFAULT 0,
  total_gold int NOT NULL DEFAULT 0,
  CONSTRAINT fk_player_stat_user FOREIGN KEY (user_id) REFERENCES app_user(id) ON DELETE CASCADE
);
