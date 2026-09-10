#!/usr/bin/env bash
# Desc: Combines PDF files into a single PDF file
# Depends: pdftk 2.02-5 ( https://www.pdflabs.com/tools/pdftk-the-pdf-toolkit/ )
# Version 0.0.1

yell() { echo "$0: $*" >&2; } # print script path and all args to stderr
die() { yell "$*"; exit 111; } # same as yell() but non-zero exit status
must() { "$@" || die "cannot $*"; } # runs args as command, reports args if command fails
showUsage() {
    # Desc: Display script usage information
    # Usage: showUsage
    # Version 0.0.2
    # Input: none
    # Output: stdout
    # Depends: GNU-coreutils 8.30 (cat)
    cat <<'EOF'
    USAGE:
        combine_pdfs.sh [FILE output] [FILES input...]

    EXAMPLE:
      combine_pdfs.sh output.pdf input1.pdf input2.pdf
      combine_pdfs.sh output.pdf input*.pdf
EOF
} # Display information on how to use this script.
checkDepends() {
    if ! command -v pdftk 1>/dev/random 2>&1; then
        showUsage;
        die "FATAL:Missing pdftk."; fi;
}; # Check dependencies
checkArgs() {
    local narg;
    
    # Check arguments
    narg=0;
    for arg in "$@"; do
        #yell "DEBUG:Checking argument:$arg";
        if [[ $narg -le 0 ]]; then
            if [[ ! -f "$arg" ]]; then
                ((narg++)); continue;
            else
                ## Get permission to overwrite existing output file
                yell "WARNING:Overwrite output file \"$arg\"? (y/n)";
                read -r prompt;
                case "$prompt" in
                    "y" | "yes" | "Yes" | "YES" )
                        ;;
                    "n" | "no" | "No" | "NO" )
                        showUsage; die "FATAL:Aborted.";
                        ;;
                    *)
                        showUsage; die "FATAL:Invalid response.";
                        ;;
                esac;
            fi;
        fi; # handle first arg
        
        if [[ ! -f "$arg" ]]; then
            showUsage; die "FATAL:File does not exist:$arg"; fi;
        ((narg++));
    done;

    return 0;
};
combinePDFs() {
    # Desc: Combines PDFs and writes to output PDF file
    # Depends: pdftk 2.02-5
    local cmd path_fo;
    local -a paths_fi;

    # Save output file path
    path_fo="$1";
    
    # Form array of input file paths
    paths_fi=("$@");
    unset 'paths_fi[0]'; # discard first path which is output file

    # Form command array
    cmd+=("pdftk"); # executable
    cmd+=("${paths_fi[@]}"); # input file paths
    cmd+=("cat" "output");
    cmd+=("$path_fo");
    #yell "DEBUG:cmd:$(declare -p cmd)";
    #yell "DEBUG:cmd:${cmd[*]}";

    # Execute command array
    "${cmd[@]}";
}; # Combines PDFs and writes to output PDF file
main() {
    #yell "DEBUG:$(args=("$@"); declare -p args)";
    checkDepends;
    checkArgs "$@";
    combinePDFs "$@";
    exit 0;
}; # main program

main "$@";

# Author: Steven Baltakatei Sandoval
# License: GPLv3+

# # Copyright notices

# pdftk port to java 3.2.2 a Handy Tool for Manipulating PDF Documents
# Copyright (c) 2017-2018 Marc Vinyals - https://gitlab.com/pdftk-java/pdftk
# Copyright (c) 2003-2013 Steward and Lee, LLC.
# pdftk includes a modified version of the iText library.
# Copyright (c) 1999-2009 Bruno Lowagie, Paulo Soares, et al.
# This is free software; see the source code for copying conditions. There is
# NO warranty, not even for MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.


