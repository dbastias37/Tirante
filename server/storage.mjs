import {DatabaseSync} from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import {readFile,writeFile,rename,unlink,stat} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';

const TTL=30*60*1000;
// Same revision-checked store contract as the original D1 implementation.
// Run ONE Node process/Render instance per DATA_DIR.
export class SQLiteRooms {
  constructor(dataDir){
    mkdirSync(dataDir,{recursive:true});
    this.db=new DatabaseSync(join(dataDir,'tirante.sqlite'),{timeout:5000});
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;
      CREATE TABLE IF NOT EXISTS pvp_rooms(code TEXT PRIMARY KEY, revision INTEGER NOT NULL DEFAULT 0, data TEXT NOT NULL, expires_at INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS rooms_expiry ON pvp_rooms(expires_at);
      CREATE TABLE IF NOT EXISTS pvp_limits(key TEXT PRIMARY KEY, count INTEGER NOT NULL DEFAULT 0, expires_at INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS limits_expiry ON pvp_limits(expires_at);`);
    this.queries={
      get:this.db.prepare('SELECT revision,data,expires_at FROM pvp_rooms WHERE code=?'),
      insert:this.db.prepare('INSERT OR IGNORE INTO pvp_rooms(code,data,expires_at) VALUES(?,?,?)'),
      cas:this.db.prepare('UPDATE pvp_rooms SET data=?,revision=revision+1,expires_at=? WHERE code=? AND revision=?'),
      limit:this.db.prepare('INSERT INTO pvp_limits(key,count,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count'),
      cleanRooms:this.db.prepare('DELETE FROM pvp_rooms WHERE code IN (SELECT code FROM pvp_rooms WHERE expires_at<? LIMIT 100)'),
      cleanLimits:this.db.prepare('DELETE FROM pvp_limits WHERE expires_at<?')
    };
  }
  async get(code){return this.queries.get.get(code)??null;}
  async insert(room){return this.queries.insert.run(room.code,JSON.stringify(room),room.lastTick+TTL).changes===1;}
  async cas(code,revision,room,now){return this.queries.cas.run(JSON.stringify(room),now+TTL,code,revision).changes===1;}
  async limit(key,now){return this.queries.limit.get(key,now+3600000).count<=30;}
  async cleanup(now){this.queries.cleanRooms.run(now);this.queries.cleanLimits.run(now);}
  health(){this.db.prepare('SELECT 1').get();}
  close(){this.db.close();}
}

// Content-addressed PNG files replace R2. Writes become visible atomically.
export class DiskPrints {
  constructor(dataDir){this.root=join(dataDir,'prints');mkdirSync(this.root,{recursive:true});}
  path(key){if(!/^prints\/[a-f0-9]{64}\.png$/.test(key))throw new Error('Estampado no válido.');return join(this.root,key.slice(7));}
  async put(key,bytes){
    const target=this.path(key);try{await stat(target);return;}catch(e){if(e.code!=='ENOENT')throw e;}
    const temporary=target+'.'+randomUUID()+'.tmp';
    try{await writeFile(temporary,bytes,{flag:'wx',mode:0o600});await rename(temporary,target);}
    finally{await unlink(temporary).catch(e=>{if(e.code!=='ENOENT')throw e;});}
  }
  async get(id){try{return await readFile(this.path(`prints/${id}.png`));}catch(e){if(e.code==='ENOENT')return null;throw e;}}
}
