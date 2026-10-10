---
description: 기능 브랜치를 main에 rebase 후 fast-forward로 머지하고 정리
argument-hint: <브랜치>
---
$ARGUMENTS 브랜치를 main에 머지한다.

어느 단계든 명령이 실패하거나 결과가 예상과 다르면 다음 단계로 가지 말고 멈추고 보고한다. 특히 range-diff를 확인하지 못했으면 main에 푸시하지 않는다.

1. git fetch origin 후 로컬 main을 git pull --ff-only로 맞춘다.
2. rebase 전에 git merge-base origin/main <브랜치>로 merge-base를 구하고, rebase 전 브랜치 끝 커밋 해시(OLD_TIP, git rev-parse <브랜치>)와 함께 기억해 둔다. 원격 브랜치가 없거나 로컬이 앞서 있어도 로컬 브랜치 기준이다.
3. 그 브랜치의 worktree(없으면 원격 브랜치로 새 worktree)에서 origin/main 위로 rebase한다. 충돌이 나면 양쪽 변경을 모두 살리고 어떻게 해소했는지 적는다.
4. npm ci, npm run build, npm test를 돌린다. 하나라도 실패하면 멈추고 보고한다.
5. 푸시 전에 git range-diff <merge-base>..<OLD_TIP> origin/main..HEAD로 확인한다. 원격 브랜치에 의존하지 않는다. 충돌 해소로 생긴 !는 차이 내용을 보여주고 의도한 해소면 계속한다. 그 밖의 !나 짝 없는 커밋이 있으면 푸시하지 말고 보고한다.
6. git push origin HEAD:main으로 fast-forward한다. force 금지. 거부되면 이후 단계(삭제 포함)로 가지 말고 1부터 다시 한다.
   - 5단계 range-diff 확인과 이 main 푸시가 끝나기 전에는 기능 브랜치를 푸시하지 않는다(--force-with-lease 포함). 원격 브랜치가 없어도 머지할 수 있다.
7. git log origin/main --oneline -3 결과를 보여준다.
8. main 푸시가 성공했고 5단계 range-diff가 전부 =(또는 의도한 해소의 !)였을 때만 worktree, 로컬 브랜치, 원격 브랜치(있으면)를 삭제한다. 삭제 명령은 앞 단계 명령과 &&로 이어 붙이지 말고 푸시 결과를 확인한 뒤 따로 실행한다.
   - 그 밖의 !나 짝 없는 커밋이 있으면 삭제하지 말고 보고한다.
   - ExitWorktree가 소유권 문제로 거부하면 git worktree remove로 직접 지운다. 다른 세션이 쓰는 중인 worktree는 건드리지 않는다.
9. 로컬 main을 git pull --ff-only로 다시 맞춘다.
10. docs/STATUS.md가 있으면 "main 반영"과 "진행 중" 칸을 갱신하고, 기준 줄(날짜, main 커밋)도 갱신하고, git pull --rebase 후 "docs(status): <브랜치> 반영" 메시지로 main에 바로 커밋·푸시한다(force 금지).
11. 보고: 머지한 커밋 범위, 테스트 결과, 삭제한 것, 남은 worktree.
