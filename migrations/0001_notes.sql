CREATE TABLE notes(id TEXT PRIMARY KEY, owner_email TEXT NOT NULL, data TEXT NOT NULL CHECK(json_valid(data)), updated_at TEXT NOT NULL);
CREATE INDEX notes_owner ON notes(owner_email);
CREATE TRIGGER notes_owner_immutable BEFORE UPDATE OF owner_email ON notes WHEN NEW.owner_email<>OLD.owner_email BEGIN SELECT RAISE(ABORT,'Ownership cannot be changed'); END;
CREATE TABLE tool_requests(owner_email TEXT NOT NULL, request_key TEXT NOT NULL, fingerprint TEXT NOT NULL, result TEXT NOT NULL CHECK(json_valid(result)), created_at TEXT NOT NULL, PRIMARY KEY(owner_email,request_key));
