## Spec
### Server
WebRTC 시그널링 용 서버.
Package management 서비스는 `yarn`을 이용함.

### Client
1. React, Typescript, styled-components 를 베이스로 하는 프로젝트.
1. WebRTC를 이용하여 간단한 명령어를 연결된 peer들 끼리 전파할 수 있다.
1. Host peer는 본인의 연결 주소를 알 수 있다.
1. Other peer는 Host peer의 주소를 입력해야지만 접속이 가능하다.


### Folder structure
```
/root
- server
- client
```

### Deploy
배포 서비스: Glitch
