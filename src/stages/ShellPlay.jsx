import { useEffect, useRef, useState } from 'react';
import { StageWindow } from './StageKit';

// A tiny shell that runs in the browser: pipes, redirection and the classic
// text tools over a small in-memory file system. Same ideas as the C shell
// (fork → pipe → dup2 → exec), interpreted here so anyone can try it.

const initialFs = () => ({
  '/home/tilak/names.txt': 'grace\nada\nlinus\nbarbara\nken\nada\n',
  '/home/tilak/notes.txt': 'fork() makes a child process\nexec() replaces its program\npipe() joins two processes\ndup2() rewires stdin and stdout\n',
  '/home/tilak/src/main.c': 'int main(void) {\n  return run_shell();\n}\n',
  '/home/tilak/src/parse.c': '/* split a line into commands at | */\n',
  '/home/tilak/src/jobs.c': '/* background jobs and waitpid */\n',
  '/home/tilak/src/README.md': '# tsh\nA small Unix shell in C.\n',
});

const HELP = `commands: ls  cat  echo  pwd  cd  grep  sort [-r]  uniq  wc [-l]  head [-n N]  tail [-n N]
          clear  history  whoami  date  help
pipes:    ls src | grep "\\.c" | wc -l
redirect: sort names.txt > sorted.txt    echo hi >> notes.txt    wc -l < names.txt`;

const lines = (s) => (s === '' ? [] : s.replace(/\n$/, '').split('\n'));
const join = (arr) => (arr.length ? `${arr.join('\n')}\n` : '');

function tokenize(src) {
  const out = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let m;
  while ((m = re.exec(src))) out.push(m[1] ?? m[2] ?? m[3]);
  return out;
}

export default function ShellPlay() {
  const [fs, setFs] = useState(initialFs);
  const [cwd, setCwd] = useState('/home/tilak');
  const [log, setLog] = useState([
    { kind: 'sys', text: 'tsh: a Unix shell, running in your browser. Type help, or try:' },
    { kind: 'sys', text: '  cat names.txt | sort | uniq | head -n 3' },
  ]);
  const [value, setValue] = useState('');
  const [hist, setHist] = useState([]);
  const [hi, setHi] = useState(-1);
  const scroller = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [log]);

  const resolve = (p) => {
    if (!p) return cwd;
    const parts = (p.startsWith('/') ? p : `${cwd}/${p}`).split('/');
    const stack = [];
    for (const part of parts) {
      if (!part || part === '.') continue;
      if (part === '..') stack.pop();
      else stack.push(part);
    }
    return `/${stack.join('/')}`;
  };
  const isDir = (path, files) => Object.keys(files).some((k) => k.startsWith(`${path}/`));

  const run = (raw) => {
    const files = { ...fs };
    let dir = cwd;
    const out = [];
    const err = (t) => out.push({ kind: 'err', text: t });

    const exec = (argv, stdin) => {
      const [cmd, ...args] = argv;
      const read = (name) => {
        const path = resolve(name);
        if (files[path] == null) throw new Error(`${cmd}: ${name}: No such file or directory`);
        return files[path];
      };
      const input = (rest) => (rest.length ? rest.map(read).join('') : stdin);
      const flagN = (rest, def) => {
        const i = rest.indexOf('-n');
        if (i >= 0) {
          const n = Number(rest[i + 1]);
          rest.splice(i, 2);
          return n;
        }
        return def;
      };
      switch (cmd) {
        case 'help':
          return `${HELP}\n`;
        case 'echo':
          return `${args.join(' ')}\n`;
        case 'pwd':
          return `${dir}\n`;
        case 'whoami':
          return 'visitor\n';
        case 'date':
          return `${new Date().toString()}\n`;
        case 'cd': {
          const target = resolve(args[0] || '/home/tilak');
          if (!isDir(target, files)) throw new Error(`cd: ${args[0]}: Not a directory`);
          dir = target;
          return '';
        }
        case 'ls': {
          const base = resolve(args[0]);
          const names = new Set();
          for (const k of Object.keys(files)) {
            if (!k.startsWith(`${base}/`)) continue;
            const rest = k.slice(base.length + 1);
            names.add(rest.includes('/') ? `${rest.split('/')[0]}/` : rest);
          }
          if (!names.size && files[base] == null) throw new Error(`ls: ${args[0]}: No such file or directory`);
          return join([...names].sort());
        }
        case 'cat':
          return input(args);
        case 'grep': {
          const [pat, ...rest] = args;
          if (!pat) throw new Error('grep: missing pattern');
          let re;
          try {
            re = new RegExp(pat);
          } catch {
            throw new Error(`grep: bad pattern: ${pat}`);
          }
          return join(lines(input(rest)).filter((l) => re.test(l)));
        }
        case 'sort': {
          const rev = args.includes('-r');
          const sorted = lines(input(args.filter((a) => a !== '-r'))).sort();
          return join(rev ? sorted.reverse() : sorted);
        }
        case 'uniq':
          return join(lines(input(args)).filter((l, i, a) => i === 0 || l !== a[i - 1]));
        case 'wc': {
          const onlyL = args.includes('-l');
          const text = input(args.filter((a) => a !== '-l'));
          const l = lines(text).length;
          return onlyL ? `${l}\n` : `${l} ${text.split(/\s+/).filter(Boolean).length} ${text.length}\n`;
        }
        case 'head': {
          const rest = [...args];
          const n = flagN(rest, 10);
          return join(lines(input(rest)).slice(0, n));
        }
        case 'tail': {
          const rest = [...args];
          const n = flagN(rest, 10);
          return join(lines(input(rest)).slice(-n));
        }
        default:
          throw new Error(`tsh: ${cmd}: command not found`);
      }
    };

    const line = raw.trim();
    out.push({ kind: 'cmd', text: line });
    if (!line) return { out, files, dir };
    if (line === 'clear') return { clear: true, files, dir };
    if (line === 'history') {
      hist.concat(line).forEach((h, i) => out.push({ kind: 'out', text: `${String(i + 1).padStart(3)}  ${h}` }));
      return { out, files, dir };
    }
    try {
      const stages = line.split('|').map((s) => s.trim());
      let data = '';
      stages.forEach((stage, i) => {
        let argv = tokenize(stage);
        let outFile = null;
        let append = false;
        const gt = argv.findIndex((a) => a === '>' || a === '>>');
        if (gt >= 0) {
          append = argv[gt] === '>>';
          outFile = argv[gt + 1];
          argv = argv.slice(0, gt);
        }
        const lt = argv.indexOf('<');
        let stdin = i === 0 ? '' : data;
        if (lt >= 0) {
          const path = resolve(argv[lt + 1]);
          if (files[path] == null) throw new Error(`tsh: ${argv[lt + 1]}: No such file or directory`);
          stdin = files[path];
          argv = argv.slice(0, lt);
        }
        if (!argv.length) throw new Error('tsh: syntax error');
        data = exec(argv, stdin);
        if (outFile) {
          const path = resolve(outFile);
          files[path] = append ? (files[path] || '') + data : data;
          data = '';
        }
      });
      lines(data).forEach((t) => out.push({ kind: 'out', text: t }));
    } catch (e) {
      err(e.message);
    }
    return { out, files, dir };
  };

  const submit = (e) => {
    e.preventDefault();
    const res = run(value);
    setFs(res.files);
    setCwd(res.dir);
    if (value.trim()) setHist((h) => [...h, value.trim()]);
    setHi(-1);
    setValue('');
    if (res.clear) setLog([]);
    else setLog((l) => [...l, ...res.out].slice(-200));
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowUp' && hist.length) {
      e.preventDefault();
      const n = Math.min(hist.length - 1, hi + 1);
      setHi(n);
      setValue(hist[hist.length - 1 - n]);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const n = hi - 1;
      setHi(Math.max(-1, n));
      setValue(n >= 0 ? hist[hist.length - 1 - n] : '');
    } else if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault();
      setLog([]);
    }
  };

  const prompt = `visitor@tsh:${cwd.replace('/home/tilak', '~')}$`;
  const examples = ['ls src | grep "\\.c" | wc -l', 'cat names.txt | sort | uniq', 'sort -r names.txt > sorted.txt', 'cat sorted.txt | head -n 2'];

  return (
    <div>
      <StageWindow title="tsh · try it">
        <div ref={scroller} className="stage-code h-[19rem] overflow-y-auto px-4 py-3" onClick={() => inputRef.current?.focus({ preventScroll: true })}>
          {log.map((l, i) => (
            <p key={i} className={`whitespace-pre-wrap break-words ${l.kind === 'err' ? 'text-[color:var(--danger)]' : l.kind === 'sys' ? 'text-muted' : l.kind === 'cmd' ? 'text-ink' : 'text-body'}`}>
              {l.kind === 'cmd' && <span className="text-accent">{prompt} </span>}
              {l.text}
            </p>
          ))}
          <form onSubmit={submit} className="flex items-center gap-2">
            <label htmlFor="tsh-in" className="flex-none text-accent">
              {prompt}
            </label>
            <input
              id="tsh-in"
              ref={inputRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={onKeyDown}
              className="min-w-0 flex-1 border-0 bg-transparent p-0 text-ink caret-[color:var(--accent)] outline-none focus-visible:outline-none"
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              aria-label="Shell command"
            />
          </form>
        </div>
      </StageWindow>
      <div className="mt-3 flex flex-wrap gap-2">
        {examples.map((ex) => (
          <button
            key={ex}
            type="button"
            className="chip hover:border-[var(--border-strong)]"
            onClick={() => {
              setValue(ex);
              inputRef.current?.focus({ preventScroll: true });
            }}
          >
            {ex}
          </button>
        ))}
      </div>
    </div>
  );
}
