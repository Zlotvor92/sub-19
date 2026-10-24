import json, sys
for D in sys.argv[1:]:
  s = json.load(open(f'idemp-{D}.json'))
  def top(t):
    u = [v for k, v in s[t].items() if 'UNDER_EXECUTION' in k]; o = [v for k, v in s[t].items() if 'UNDER_EXECUTION' not in k]
    p = [v for k, v in s[t].items() if 'PAIN' in k and 'UNDER_EXECUTION' not in k]
    return f"{t}: manjak {sum(v[1] for v in u)}/{sum(v[0] for v in u)}, ostalo {sum(v[1] for v in o)}/{sum(v[0] for v in o)} (bol bez manjka {sum(v[1] for v in p)}/{sum(v[0] for v in p)})"
  print(D, s['to'], 'lanaca', s['steps'], 'koraka |', top('same'), '|', top('next'))
