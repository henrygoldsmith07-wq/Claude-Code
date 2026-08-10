'use strict';

const BASH = `# rtk bash completion — add to ~/.bashrc: eval \"$(rtk completion bash)\"
_rtk() {
  local cur=\"\${COMP_WORDS[COMP_CWORD]}\"
  local cmds=\"err gain init version help completion --help --version\"
  local flags=\"--json --explain --raw --no-redact --aggressive --conservative --balanced --stats --stdin --help\"
  if [[ $COMP_CWORD -eq 1 ]]; then COMPREPLY=( $(compgen -W \"$cmds $flags\" -- \"$cur\") ); return; fi
  case \"\${COMP_WORDS[1]}\" in
    err) COMPREPLY=( $(compgen -W \"$flags\" -- \"$cur\") ) ;;
    gain) COMPREPLY=( $(compgen -W \"--json\" -- \"$cur\") ) ;;
    completion) COMPREPLY=( $(compgen -W \"bash zsh fish\" -- \"$cur\") ) ;;
  esac
}
complete -F _rtk rtk
`;

const ZSH = `#compdef rtk\n# rtk zsh completion — add to ~/.zshrc: eval \"$(rtk completion zsh)\"\n_rtk() {\n  local -a cmds flags\n  cmds=('err:run with parser' 'gain:show savings' 'init:wire CLAUDE.md' 'version:print version' 'completion:print completion script')\n  flags=('--json' '--explain' '--raw' '--no-redact' '--aggressive' '--conservative' '--balanced' '--stats' '--stdin')\n  _arguments '1: :{_describe \"command\" cmds}' '*: :{_values \"flag\" $flags}'\n}\n_rtk\n`;

const FISH = `# rtk fish completion — rtk completion fish | source\ncomplete -c rtk -f\ncomplete -c rtk -n \"__fish_use_subcommand\" -a err -d \"run with parser\"\ncomplete -c rtk -n \"__fish_use_subcommand\" -a gain -d \"show savings\"\ncomplete -c rtk -n \"__fish_use_subcommand\" -a init -d \"wire CLAUDE.md\"\ncomplete -c rtk -n \"__fish_use_subcommand\" -a version -d \"print version\"\ncomplete -c rtk -n \"__fish_use_subcommand\" -a completion -d \"completion script\"\ncomplete -c rtk -l json -d \"structured JSON output\"\ncomplete -c rtk -l explain -d \"per-line trace\"\ncomplete -c rtk -l raw -d \"write raw log\"\ncomplete -c rtk -l stats -d \"output statistics\"\n`;

function completionScript(shell) {
  if (shell === 'bash') return BASH;
  if (shell === 'zsh') return ZSH;
  if (shell === 'fish') return FISH;
  return null;
}

module.exports = { completionScript, BASH, ZSH, FISH };
