import sys, json, subprocess, pty, fcntl, os, select

content = json.loads(sys.stdin.read())

(pid, fd) = pty.fork()
if pid != 0:
    try: 
        while True:
            d = os.read(fd, 1024*1024)
            if not d: break
            os.write(1, d)
    except OSError:
        pass

    (_, state) = os.waitpid(pid, 0)
    sys.exit(-os.WTERMSIG(state) if os.WTERMSIG(state) != 0 else os.WEXITSTATUS(state))


os.environ['name'] = 'xterm-color'
os.environ['TERM'] = 'xterm'


def run(args):
    os.write(1, ("> %s\n"%(" ".join(args))).encode("utf-8"))
    subprocess.check_call(args)

def run2(args):
    os.write(1, ("> %s\n"%(" ".join(args))).encode("utf-8"))
    subprocess.call(args)

old = content['old']
new = content['new']

egroups = set()
for line in open('/etc/group', 'r'):
    group = line.split(":")[0]
    egroups.add(group)

if not new or not old or old['name'] != new['name'] or old['system'] != new['system']:
    if old:
        run2(['userdel', old['name']])
    if new:
        run2(['userdel', new['name']])
        args = ['useradd']
        groups = set(new['groups'])
        if new['system']:
            args.append('-M')
            args.append('-N')
            args.append('-r')
        else:
            args.append('-U')
            args.append('-m')
        if new['sudo']:
            groups.add('sudo')
        if new['password']:
            args.append('-p')
            args.append(new['password'])     
        args.append('-G')
        args.append(','.join(groups & egroups))
        args.append(new['name'])
        run(args)
else:
    args = ['usermod']
    groups = set(new['groups'])
    if new['password']:
        args.append('-p')
        args.append(new['password'])
    else:
        run(['passwd', '-d',  new['name']])
    if new['sudo']:
        groups.add('sudo')
    if not new['system']:
        groups.add(new['name'])
    args.append('-G')
    args.append(','.join(groups & egroups))
    args.append(new['name'])
    run(args)