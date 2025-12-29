import os

EXCLUDE_DIRS = {'node_modules', 'venv', '__pycache__', '.git', 'archive', 'evm_env'}
EXCLUDE_FILES = {'.DS_Store'}
BINARY_EXTS = {'.png', '.jpg', '.jpeg', '.ico', '.gif', '.webp', '.svg', '.json', '.txt', '.csv'}

def is_binary(filename):
    ext = os.path.splitext(filename)[1].lower()
    return ext in BINARY_EXTS

def list_files(startpath):
    structure = []
    filepaths = []
    for root, dirs, files in os.walk(startpath):
        # Filter out excluded dirs
        dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS and not d.startswith('.')]
        level = root.replace(startpath, '').count(os.sep)
        indent = '│   ' * level
        folder = os.path.basename(root)
        if level == 0:
            structure.append(f"{folder}/")
        else:
            structure.append(f"{indent}├── {folder}/")
        for f in sorted(files):
            if f in EXCLUDE_FILES or f.startswith('.'):
                continue
            relpath = os.path.join(root, f)
            structure.append(f"{indent}│   ├── {f}")
            filepaths.append(relpath)
    return structure, filepaths

def main():
    root = os.path.dirname(os.path.abspath(__file__))
    structure, filepaths = list_files(root)
    with open('repo_structure_and_scripts.txt', 'w', encoding='utf-8') as out:
        out.write("Repository Structure\n\n")
        for line in structure:
            out.write(line + '\n')
        out.write("\n\nFile Contents\n\n")
        for path in filepaths:
            rel = os.path.relpath(path, root)
            if is_binary(path):
                out.write(f"// filepath: {rel}\n(BINARY FILE SKIPPED)\n\n")
                continue
            try:
                with open(path, 'r', encoding='utf-8') as f:
                    content = f.read()
                out.write(f"// filepath: {rel}\n")
                out.write(content)
                if not content.endswith('\n'):
                    out.write('\n')
                out.write('\n')
            except Exception as e:
                out.write(f"// filepath: {rel}\n(COULD NOT READ FILE: {e})\n\n")

if __name__ == "__main__":
    main()