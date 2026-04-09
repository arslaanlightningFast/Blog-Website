import argparse
import os
import subprocess
import sys


def run(cmd: list[str]) -> None:
    p = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    if p.returncode != 0:
        print(p.stdout)
        raise SystemExit(p.returncode)
    if p.stdout.strip():
        print(p.stdout.strip())


def main() -> int:
    ap = argparse.ArgumentParser(
        description="Subset a TTF/OTF to a small WOFF2 (and optional WOFF) for the website."
    )
    ap.add_argument("--input", required=True, help="Path to source font (.ttf/.otf)")
    ap.add_argument(
        "--out-dir",
        default=os.path.join("assets", "fonts"),
        help="Output directory (default: assets/fonts)",
    )
    ap.add_argument(
        "--family",
        default="CustomSans",
        help='CSS font-family name (default: "CustomSans")',
    )
    ap.add_argument(
        "--text",
        default=None,
        help="Subset to exactly these characters (best compression). If omitted, uses a safe Latin set.",
    )
    ap.add_argument(
        "--latin",
        action="store_true",
        help="Use a safe Latin/basic punctuation set (default if --text not provided).",
    )
    args = ap.parse_args()

    os.makedirs(args.out_dir, exist_ok=True)

    # If you don’t pass --text, we default to a conservative Latin set.
    default_text = (
        "abcdefghijklmnopqrstuvwxyz"
        "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
        "0123456789"
        " .,;:!?\"'()[]{}<>-_/\\|@#$%^&*+=~`"
        "\n\t"
    )
    text = args.text if args.text is not None else default_text

    base = f"{args.family}-latin-subset"
    out_woff2 = os.path.join(args.out_dir, f"{base}.woff2")
    out_woff = os.path.join(args.out_dir, f"{base}.woff")

    # WOFF2 (primary)
    run(
        [
            sys.executable,
            "-m",
            "fontTools.subset",
            args.input,
            f"--output-file={out_woff2}",
            "--flavor=woff2",
            "--with-zopfli",
            f"--text={text}",
            "--layout-features=*",
            "--name-IDs=*",
            "--name-legacy",
            "--name-languages=*",
            "--drop-tables+=DSIG",
        ]
    )

    # Optional WOFF (fallback for older browsers)
    run(
        [
            sys.executable,
            "-m",
            "fontTools.subset",
            args.input,
            f"--output-file={out_woff}",
            "--flavor=woff",
            "--with-zopfli",
            f"--text={text}",
            "--layout-features=*",
            "--name-IDs=*",
            "--name-legacy",
            "--name-languages=*",
            "--drop-tables+=DSIG",
        ]
    )

    print(f"Generated:\n- {out_woff2}\n- {out_woff}")
    print("\nNext: commit these outputs and deploy to GitHub Pages.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
