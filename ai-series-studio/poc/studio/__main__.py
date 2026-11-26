"""python -m studio <command>"""
import json
import sys


def main(argv: list[str]) -> int:
    if not argv:
        print(__doc__ + "\ncommands: import-e1 | packet <episode> | estimate <plan.json> | probe <video> | faces-calibrate")
        return 1
    cmd, args = argv[0], argv[1:]
    if cmd == "import-e1":
        from .importer import import_episode1
        print(json.dumps(import_episode1(), indent=2))
    elif cmd == "packet":
        from .packet import build_packet, write_packet
        print(write_packet(build_packet(int(args[0]))))
    elif cmd == "estimate":
        from .estimate import estimate_plan
        print(json.dumps(estimate_plan(args[0]), indent=2, ensure_ascii=False))
    elif cmd == "probe":
        from .qc.probe import tier1
        print(json.dumps(tier1(args[0], **json.loads(args[1]) if len(args) > 1 else {}), indent=2))
    elif cmd == "faces-calibrate":
        from .qc.faces import calibrate_episode1
        print(json.dumps(calibrate_episode1(), indent=2))
    else:
        print(f"unknown command {cmd}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
