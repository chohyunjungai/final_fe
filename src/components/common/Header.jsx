import React, { useEffect, useRef, useState } from 'react';
import styled, { keyframes } from "styled-components";
import { useNavigate } from 'react-router-dom';
import { getCookie, removeCookie } from '../../cookie/Cookie';
import { EventSourcePolyfill } from "event-source-polyfill";
import { useDispatch, useSelector } from 'react-redux';
import { __alarmSender, __alarmClean } from '../../redux/modules/alarm'
import { __logoutResetUser } from '../../redux/modules/user'
import { __logoutResetSearch } from '../../redux/modules/search'
import { useLocation } from 'react-router-dom'

function Header(props) {

    // 전역에 등록된 알람 내역 가져오기
    const alarmInfo = useSelector((state) => {
        return state.alarmInfo
    })

    // hooks
    const navigate = useNavigate();
    const eventSourceRef = useRef(null);
    const location = useLocation();
    const dispatcher = useDispatch()

    // state
    const [isLogin, setIsLogin] = useState(false)
    const [isAlarmWindowOpen, setIsAlarmWindowOpen] = useState(false)
    const [isVisible, setIsVisible] = useState(true)
    const [isAdmin, setIsAdmin] = useState(false)

    // 알람 카운트
    const [isNewNotification, setIsNewNotification] = useState(alarmInfo.filter((alarm) => { return alarm.indexOf('EventStream Created') === -1 }).length)

    const urlPathname = location.pathname;

    useEffect(() => {
        const checkLoginStatus = async () => {
            const accessKey = await getCookie('token');
            if (accessKey && !isLogin) {
                setIsLogin(accessKey ? true : false)
            } else if (!accessKey) {
                setIsLogin(false)
            }
        }
        checkLoginStatus()
        if (urlPathname === '/signup' || urlPathname === '/signin') {
            setIsVisible(false)
        }
        if (urlPathname === '/admin') {
            setIsAdmin(true)
        }
    })

    // 알람 창을 열었으면 신규 알람 아이콘 없앤다.
    useEffect(() => {
        if (isAlarmWindowOpen) {
            console.log("[INFO] 알람 확인")
            setIsNewNotification(0)
        } else if (!isAlarmWindowOpen && isNewNotification === 0) {
            //클린
            dispatcher(__alarmClean())
        }
    }, [isAlarmWindowOpen])



    useEffect(() => {
        console.log("[INFO] 알람 추가", alarmInfo)
        setIsNewNotification(alarmInfo.length)
    }, [alarmInfo])

    useEffect(() => {
        // 세션 스토리지에서 SSE 구독 상태를 확인
        const isSubscribed = sessionStorage.getItem('isSubscribed');

        if (isLogin && !isSubscribed) {
            // 로그인 상태일때 최초 한번만 구독 실행
            const subcribeSSE = async () => {
                const accessKey = await getCookie('token')
                const EventSource = EventSourcePolyfill
                if (isLogin && accessKey && !isSubscribed) {
                    eventSourceRef.current = new EventSource(
                        //헤더에 토큰
                        `${process.env.REACT_APP_SERVER_URL}/sse/subscribe`,
                        {
                            headers: {
                                'ACCESS_KEY': accessKey,
                            },
                            withCredentials: true, // 토큰 값 전달을 위해 필요한 옵션
                        }
                    )

                    if (eventSourceRef.current.readyState === 1) {
                        // console.log("[INFO] SSE connection 상태")
                    }

                    eventSourceRef.current.addEventListener('open', (event) => {
                        sessionStorage.setItem('isSubscribed', true);
                    })

                    eventSourceRef.current.addEventListener('message', (event) => {
                        const data = event.data
                        if (data.indexOf('EventStream Created') === -1) {
                            console.log("[INFO] 알람 발생", data)
                            dispatcher(__alarmSender(data))
                        }
                    })
                    return () => {
                        if (eventSourceRef.current && !isLogin) {
                            sessionStorage.setItem('isSubscribed', false)
                            //dispatcher(__alarmClean())
                            eventSourceRef.current.close() // 로그아웃 시 SSE 연결 종료
                        }
                    };
                }
            };
            subcribeSSE()
            avataGenHandler()
        }
    }, [isLogin]);

    // 아바타 생성 함수
    const avataGenHandler = (type, url, userNickName) => {
        let avataGen
        if (!type) {
            avataGen = getCookie('userProfile')
        } else {
            // 알람에 프로필 이미지의 경우
            if (url === 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTtArY0iIz1b6rGdZ6xkSegyALtWQKBjupKJQ&usqp=CAU') {
                avataGen = `https://source.boringavatars.com/beam/120/${userNickName}?colors=00F0FF,172435,394254,EAEBED,F9F9FA`
            } else {
                avataGen = url
            }
        }
        return <><img src={avataGen} alt='프로필사진' width='44px' height='44px' /></>
    }

    // 알람내용 생성 함수 
    const alarmCotentHandler = (userNickName, content) => {
        const pos = content.indexOf(userNickName)
        let highLightName
        let nonHighLightContnent
        if (pos !== -1) {
            highLightName = content.substr(pos, userNickName.length)
            nonHighLightContnent = content.substr((pos + userNickName.length))
            return <><span>{highLightName}</span>{nonHighLightContnent}</>
        } else {
            return <>{content}</>
        }

    }

    // 알림 내용 컴포넌트 생성 함수
    const renderAlertComponent = () => {
        if (alarmInfo) {
            // 전역 스토어에 저장되어있는 알람 내역
            const filterAlarm = alarmInfo.filter((alarm) => {
                return alarm.indexOf('EventStream Created') === -1
            })

            // filterAlarm
            if (filterAlarm.length === 0) {
                return (
                    <>
                        <NoneMessageImg src={`${process.env.PUBLIC_URL}/image/bell.webp`} alt="알람없을때아이콘" />
                        <NoneMessage>아직 온 알람이 없어요!</NoneMessage>
                    </>
                )
            } else {
                return (
                    <>
                        {filterAlarm && filterAlarm.map((alarm) => {
                            return (
                                <AlearmContent>
                                    <ProfileImgDivInAlarm>
                                        <img src={JSON.parse(alarm).senderProfileUrl} alt="프로필사진" width='44px' height='44px' />
                                    </ProfileImgDivInAlarm>
                                    <AlearmContentWrap onClick={onClickMyPageHandler}>
                                        <AlearmContentMsg>
                                            {alarmCotentHandler((JSON.parse(alarm).senderNickname), JSON.parse(alarm).content)}
                                        </AlearmContentMsg>
                                        <AlearmContentTime>
                                            <span>{JSON.parse(alarm).createdAt}</span>
                                        </AlearmContentTime>
                                    </AlearmContentWrap>
                                </AlearmContent>
                            )
                        })}
                    </>
                );
            }
        }
        return (
            <>
                <NoneMessageImg src={`${process.env.PUBLIC_URL}/image/bell.webp`} alt="알람없을때아이콘" />
                <NoneMessage>아직 온 알람이 없어요!</NoneMessage>
            </>
        );
    };



    const onClickLogoHandler = () => {
        if(isAdmin){
            navigate('/admin')
        }else{
            navigate('/')
        }
        
    }
    const onClickSignUpHandler = () => {
        navigate('/signup')
    }
    const onClickSignInHandler = () => {
        navigate('/signin')
    }
    const onClickLogOutHandler = () => {
        // 로그아웃 처리 쿠키 삭제
        const remove = async () => {
            removeCookie('token')
            removeCookie('refreshToken')
            removeCookie('nickName')
            removeCookie('userProfile')
            sessionStorage.removeItem('isSubscribed')
            dispatcher(__alarmClean())
            if (eventSourceRef.current) {
                eventSourceRef.current.close(); // SSE 연결 종료
            }
        }
        // remove()

        const logoutReset = async () => {
            dispatcher(__alarmClean())
        }

        const logout = async () => {
            await remove()
            await logoutReset()
            navigate('/')
        }

        logout()
    }

    const onClickMyPageHandler = () => {
        navigate('/mypage')
    }
    const onClickAlearmHandler = (isOpend) => {
        setIsAlarmWindowOpen(!isOpend)
    }


    return (
        <CommonHeader pos={props.pos}>
            <ButtonWrap>
                <HeaderLeftContent pos={props.pos}>
                    <Logo src={`${process.env.PUBLIC_URL}/image/logo.webp`} onClick={onClickLogoHandler} />
                </HeaderLeftContent>
                <HeaderRightContent>
                    {!isLogin ? <>
                        {isVisible ? <>
                            <HeaderButton onClick={onClickSignInHandler} width={67} marginRight={18}><p>로그인</p></HeaderButton>
                            <HeaderButton onClick={onClickSignUpHandler} width={115} border={true} marginRight={0}><p>회원가입</p></HeaderButton>
                        </> : <></>
                        }
                    </> : <>
                        <HeaderButton onClick={onClickLogOutHandler} width={85} marginRight={10} ><p>로그아웃</p></HeaderButton>

                        {
                            isAdmin ?
                                <>
                                </> :
                                <>
                                    <AlearmWrap>
                                        <HeaderButton onClick={() => { onClickAlearmHandler(isAlarmWindowOpen) }} marginRight={17} width={40}>
                                            {isNewNotification > 0 ? <NewNoti /> : <></>}
                                            <AlearmImg src={`${process.env.PUBLIC_URL}/image/alearmBtn.svg`} alt="알람버튼" />
                                        </HeaderButton>
                                        {!isAlarmWindowOpen ? <></> :
                                            <>
                                                <AlearHeader></AlearHeader>
                                                <AlearWrapContent>
                                                    <AlearTitle>알림</AlearTitle>
                                                    {renderAlertComponent()}
                                                </AlearWrapContent>
                                            </>
                                        }
                                    </AlearmWrap>
                                    <ProfileImgDiv onClick={onClickMyPageHandler}>
                                        {
                                            avataGenHandler()
                                        }
                                    </ProfileImgDiv>
                                </>
                        }
                    </>
                    }
                </HeaderRightContent>
            </ButtonWrap>
        </CommonHeader>
    );
}

export const CommonHeader = styled.header`
    background: transparent;
    color: #FFFFFF;
    width : 100%;
    height: 79px;
    position: ${(props) => {
        return props.pos ? 'absolute' : 'static';
    }};
`
export const ButtonWrap = styled.div`
    display: flex;
    justify-content: space-between;
    height: 100%;
    align-items : center;
`
export const HeaderLeftContent = styled.div`
    margin-left: 40px;
`
export const HeaderRightContent = styled.div`
    display: flex;
    align-items: center;
    margin-right: 40px;
`
export const ProfileImgDiv = styled.div`
    width: 44px;
    height: 44px;
    border-radius: 50%;
    overflow: hidden;
    background-color: #ffffff;
    /* box-shadow: 0 0 0 1px #ffffff; */
    box-shadow: 0 0 0 0.5px rgba(255, 255, 255, 0.8);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    cursor: pointer;
`
export const ProfileImgDivInAlarm = styled.div`
    width: 44px;
    height: 44px;
    border-radius: 50%;
    overflow: hidden;
    box-shadow: 0px 0px 3px rgba(0, 0, 0, 0.25);
    margin-right: 6px;
`

export const shakeAnimation = keyframes`
    0% { transform: translateX(0); }
    20% { transform: translateX(-3px); }
    40% { transform: translateX(3px); }
    60% { transform: translateX(-3px); }
    80% { transform: translateX(3px); }
    100% { transform: translateX(0); }
`

export const HeaderButton = styled.div`
    border: 0;
    background-color: transparent;
    color: #FFFFFF;
    height: 40px;
    width : ${(props) => {
        return props.width + 'px';
    }};
    border : ${(props) => {
        return props.border ? '1px solid #FFFFFF;' : '0';
    }};
    /* border-radius : ${(props) => {
        return props.border ? '52px;' : '0px';
    }}; */
    border-radius : 53px;
    margin-right: ${(props) => {
        return props.marginRight ? props.marginRight + 'px' : 0;
    }};

    &:hover {
        transition: 0.3s;
        background: rgba(0, 0, 0, 0.4);
    }
    &:active {
        transition: 0.2s;
        background: rgba(0, 0, 0, 0.7);
    }
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    cursor: pointer;

`
export const AlearmImg = styled.img`
    position: relative;
    display: inline-block;
    
    transition: all 0.3s;

    &:hover {
        animation: ${shakeAnimation} 0.6s;
    }
`

export const AlearmWrap = styled.div`
    position: relative;
    display: inline-block;
`

export const AlearHeader = styled.div`
    width: 40px;
    height: 40px;
    position: absolute;
    /* top: 40px;
    left: -40px; */
    background-color: #F9F9FA;
    transform: rotate(-45deg); 
    border-top-right-radius: 6px;
    /* top: 50px;
    left: -5px; */
    top: 52px;
    left: 1px;
    
`

export const AlearWrapContent = styled.div`
    width: 200px;
    height: 250px;
    position: absolute;
    /* top: 50px;
    right: 5px; */
    border-radius: 10px;
    top: 55px;
    right: -10px;
    width: 239px;
    height: 373.95px;
    background-color: #F9F9FA;
    z-index: 1;
    overflow-y:scroll;
    overflow-x: hidden;
    &::-webkit-scrollbar{
        width: 7px;
        background-color: transparent;
        border-radius: 8px;
    }
`

export const AlearTitle = styled.p`
    font-family: 'Noto Sans';
    font-style: normal;
    font-weight: 500;
    font-size: 14px;
    line-height: 114%;

    color: #464646;
    padding-top: 16px;
    padding-left: 19px;
    box-sizing: border-box;
    margin-bottom: 3px;
`
export const AlearmContent = styled.div`
    width: 209px;   
    height: 66px;
    background: #FFFFFF;
    box-shadow: 0px 0px 3px rgba(0, 0, 0, 0.25);
    border-radius: 10px;
    margin : 10px 13px 10px 13px;
    display: flex;
    padding: 12px 8px 10px;
`

export const AlearmContentMsg = styled.p`
    font-family: 'Noto Sans';   
    font-style: normal;
    font-weight: 400;
    font-size: 9px;
    line-height: 178%;
    color: #464646;
    width: 139px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow : ellipsis;
    span {
        font-weight: 700;
        color : #00CABE;
    }
`
export const AlearmContentTime = styled.div`
    font-family: 'Noto Sans';
    font-style: normal;
    font-weight: 400;
    font-size: 7px;
    text-align: right;
    color: #464646;
    display: flex;
    flex-direction: column;
`
export const AlearmContentWrap = styled.div`
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    margin-top: 5px;
    cursor: pointer;
`


export const NoneMessageImg = styled.img`
    margin: 102px 93px 12px;

`
export const NoneMessage = styled.p`
    font-family: 'Noto Sans';
    font-style: normal;
    font-weight: 500;
    font-size: 10px;
    line-height: 160%;
    text-align: center;
    color: #BEBEBE;
    // 스크롤바 너비만큼 마진 줘서 가운데 가운데 정렬함.
    margin-left: 7px;
`

export const Logo = styled.img`
    cursor: pointer;
`

export const NewNoti = styled.div`
    width: 10px;
    height: 10px;
    overflow: hidden;
    border-radius: 50%;
    background-color: #FF635D;
    position: absolute;
    top: 5px;
    left: 10px;
    z-index: 1;
`
export default Header;