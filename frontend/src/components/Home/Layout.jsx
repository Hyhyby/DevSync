// src/components/Home/Layout.jsx
import React, { useState, useRef, useEffect } from "react";

const Layout = ({ logo }) => {
  // 3D 틸트 및 인터랙션 상태 관리
  const [rotate, setRotate] = useState({ x: 0, y: 0 });
  const [isHovering, setIsHovering] = useState(false);
  const [isLogoHovered, setIsLogoHovered] = useState(false); // 로고 호버 여부 체크
  const [balls, setBalls] = useState([]); // 생성된 공(Superballs) 관리
  const cardRef = useRef(null);

  // 랜덤 색상 추출 함수
  const getRandomColor = () => {
    const colors = [
      "bg-red-500",
      "bg-orange-500",
      "bg-amber-400",
      "bg-yellow-400",
      "bg-lime-500",
      "bg-green-500",
      "bg-emerald-400",
      "bg-teal-400",
      "bg-cyan-400",
      "bg-sky-500",
      "bg-blue-500",
      "bg-indigo-500",
      "bg-violet-500",
      "bg-purple-500",
      "bg-fuchsia-500",
      "bg-pink-500",
      "bg-rose-500",
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  };

  // 마우스 움직임 계산 함수 (카드 틸트)
  const handleMouseMove = (e) => {
    if (!cardRef.current) return;

    // 로고 위에 있을 땐 틸트 효과 계산 중지 (정면 유지)
    if (isLogoHovered) {
      setRotate({ x: 0, y: 0 });
      return;
    }

    const rect = cardRef.current.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const xPct = mouseX / width - 0.5;
    const yPct = mouseY / height - 0.5;

    // 회전 각도 계산
    const x = yPct * 100;
    const y = -xPct * 100;

    setRotate({ x, y });
  };

  // 카드 영역에서 마우스 나갔을 때
  const handleMouseLeave = () => {
    setIsHovering(false);
    setIsLogoHovered(false);
    setRotate({ x: 0, y: 0 });
  };

  // 로고 클릭 시 공 추가 (Superball Effect)
  const handleLogoClick = (e) => {
    e.stopPropagation(); // 카드 틸트 방해 금지

    const newBall = {
      id: Date.now() + Math.random(),
      color: getRandomColor(),
      // 화면 내 랜덤 위치 (10% ~ 90%)
      left: Math.random() * 80 + 10,
      top: Math.random() * 80 + 10,
      // 랜덤 크기
      size: Math.random() * 30 + 20,
      // 애니메이션 방향 랜덤화 (CSS 변수로 전달)
      moveX: (Math.random() - 0.5) * 200,
      moveY: (Math.random() - 0.5) * 200,
    };

    setBalls((prev) => [...prev, newBall]);

    // 2초 뒤 해당 공 삭제 (메모리 관리)
    setTimeout(() => {
      setBalls((prev) => prev.filter((ball) => ball.id !== newBall.id));
    }, 2000);
  };

  return (
    <main className="flex-1 w-full h-full bg-slate-950 flex items-center justify-center overflow-hidden relative perspective-1000">
      {/* Superball 렌더링 레이어 (배경보다는 위, 카드보다는 뒤 혹은 앞) */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-20">
        {balls.map((ball) => (
          <div
            key={ball.id}
            className={`absolute rounded-full shadow-lg ${ball.color} opacity-90`}
            style={{
              left: `${ball.left}%`,
              top: `${ball.top}%`,
              width: `${ball.size}px`,
              height: `${ball.size}px`,
              // 공이 튀어나오는 애니메이션
              animation:
                "superball-pop 2s cubic-bezier(0.25, 1, 0.5, 1) forwards",
              "--move-x": `${ball.moveX}px`,
              "--move-y": `${ball.moveY}px`,
            }}
          />
        ))}
      </div>

      {/* 배경 장식 (CSS 애니메이션) */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-600/20 rounded-full blur-[100px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600/20 rounded-full blur-[100px] animate-pulse delay-1000" />
      </div>

      {/* 3D 틸트 카드 컨테이너 */}
      <div
        ref={cardRef}
        onMouseMove={(e) => {
          setIsHovering(true);
          handleMouseMove(e);
        }}
        onMouseLeave={handleMouseLeave}
        style={{
          transform: isHovering
            ? `perspective(1000px) rotateX(${-rotate.x}deg) rotateY(${
                rotate.y
              }deg) scale(1.02)`
            : "perspective(1000px) rotateX(0deg) rotateY(0deg) scale(1)",
          // 로고 호버 중일 땐 더 빠르게 정면으로 돌아오도록 설정
          transition: isLogoHovered
            ? "transform 0.2s ease-out"
            : "transform 0.1s ease-out",
        }}
        className="relative z-30" // 공보다 위에 보이도록 z-index 설정 (공이 가리지 않게 하려면 z-10)
      >
        <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 p-10 rounded-3xl shadow-2xl text-center max-w-md mx-auto ring-1 ring-white/5">
          {/* 로고 영역 */}
          <div
            className="relative inline-block group cursor-pointer select-none"
            onMouseEnter={() => setIsLogoHovered(true)}
            onMouseLeave={() => setIsLogoHovered(false)}
            onClick={handleLogoClick}
          >
            {/* 로고 뒤 글로우 효과 */}
            <div className="absolute -inset-1 bg-gradient-to-r from-cyan-400 to-blue-600 rounded-full blur opacity-20 group-hover:opacity-75 transition duration-500" />

            <img
              src={logo}
              alt="DevSync Logo"
              className={`relative w-36 h-36 mx-auto object-contain drop-shadow-xl transform transition-transform duration-500 
                ${
                  isLogoHovered
                    ? "scale-110"
                    : "group-hover:scale-110 group-hover:rotate-3"
                }
              `}
            />

            {/* 클릭 유도 텍스트 (로고 호버 시에만 표시) */}
            <div
              className={`absolute left-1/2 -translate-x-1/2 -bottom-6 text-sm font-bold text-cyan-400 whitespace-nowrap transition-all duration-300 ${
                isLogoHovered
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 -translate-y-2"
              }`}
            >
              Click Me! ✨
            </div>
          </div>

          <p className="mt-8 text-slate-400">
            채널을 선택하여 대화를 시작해보세요.
          </p>

          {/* 기능 태그들 */}
          <div className="mt-8 grid grid-cols-2 gap-3 text-sm">
            {[
              {
                label: "Real-time",
                color:
                  "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
              },
              {
                label: "Voice & Video",
                color: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
              },
              {
                label: "Secure Auth",
                color: "bg-rose-500/10 text-rose-400 border-rose-500/20",
              },
              {
                label: "Socket.io",
                color: "bg-amber-500/10 text-amber-400 border-amber-500/20",
              },
            ].map((feature) => (
              <div
                key={feature.label}
                className={`px-3 py-2 rounded-lg border ${feature.color} font-medium transition-all hover:bg-opacity-20`}
              >
                {feature.label}
              </div>
            ))}
          </div>

          <div className="mt-8 text-xs text-slate-500 font-mono">
            Waiting for connection...
            <span className="inline-block w-2 h-2 ml-2 bg-green-500 rounded-full animate-ping" />
          </div>
        </div>
      </div>

      {/* Superball 애니메이션 Keyframes */}
      <style>{`
        @keyframes superball-pop {
          0% {
            transform: translate(0, 0) scale(0);
            opacity: 0;
          }
          20% {
            opacity: 1;
            transform: translate(0, 0) scale(1.2);
          }
          100% {
            opacity: 0;
            transform: translate(var(--move-x), var(--move-y)) scale(0.5);
          }
        }
      `}</style>
    </main>
  );
};

export default Layout;
