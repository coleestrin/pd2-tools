import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  getBrightBorderColor,
  getDarkBackgroundColor,
  getItemTypeBaseColor,
} from "./item-colors";

export interface ItemData {
  gearId: { name: string };
  imageUrl: string;
  runes: string | null;
  itemType: string;
  requiredLevel: string;
  afterAttributes: string;
  newAttributes: string;
}

// Convert hex to RGB
const hexToRgb = (hex: string): { r: number; g: number; b: number } => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
};

export const ItemTooltip = ({
  children,
  itemData,
  itemType,
  itemName,
}: {
  children: React.ReactNode;
  itemData: ItemData | undefined;
  itemType: string;
  itemName: string;
}) => {
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState<{
    top: number;
    left: number;
    side: "left" | "right";
  }>({
    top: 0,
    left: 0,
    side: "right",
  });
  const triggerRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout>();

  const handleEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    timeoutRef.current = setTimeout(() => {
      if (triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect();
        const viewportMargin = 24;
        const estimatedHalfTooltipHeight = 170;
        const estimatedTooltipWidth = 320;
        const gap = 12;
        const preferredTop = rect.top + rect.height / 2;
        const clampedTop = Math.max(
          viewportMargin + estimatedHalfTooltipHeight,
          Math.min(
            window.innerHeight - viewportMargin - estimatedHalfTooltipHeight,
            preferredTop
          )
        );
        const placeLeft =
          rect.right + gap + estimatedTooltipWidth >
          window.innerWidth - viewportMargin;
        const left = placeLeft
          ? Math.max(viewportMargin, rect.left - gap - estimatedTooltipWidth)
          : Math.min(
              rect.right + gap,
              window.innerWidth - viewportMargin - estimatedTooltipWidth
            );

        setPos({
          top: clampedTop,
          left,
          side: placeLeft ? "left" : "right",
        });
        setShow(true);
      }
    }, 250);
  };

  const handleLeave = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setShow(false);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const borderColor = getBrightBorderColor(itemType);
  const baseColor = getItemTypeBaseColor(itemType);
  const { r, g, b } = hexToRgb(baseColor);
  const gradientStart = `rgba(${r}, ${g}, ${b}, 0.35)`;
  const gradientMid = `rgba(${r}, ${g}, ${b}, 0.12)`;

  const attributes = itemData?.afterAttributes || itemData?.newAttributes || "";
  const attributeList = attributes
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        style={{ width: "100%" }}
      >
        {children}
      </div>

      {show &&
        createPortal(
          <div
            style={{
              position: "fixed",
              top: `${pos.top}px`,
              left: `${pos.left}px`,
              transform: "translateY(-50%)",
              zIndex: 99999,
              pointerEvents: "none",
            }}
          >
            <div
              style={{
                position: "absolute",
                left: pos.side === "right" ? "-5px" : "auto",
                right: pos.side === "left" ? "-5px" : "auto",
                top: "50%",
                transform: "translateY(-50%)",
                width: 0,
                height: 0,
                borderTop: "5px solid transparent",
                borderBottom: "5px solid transparent",
                borderRight:
                  pos.side === "right" ? `5px solid ${borderColor}` : "none",
                borderLeft:
                  pos.side === "left" ? `5px solid ${borderColor}` : "none",
              }}
            />

            <div
              style={{
                border: `1.5px solid ${borderColor}`,
                borderRadius: "4px",
                background: `linear-gradient(to bottom, ${gradientStart} 0%, ${gradientMid} 30%, rgba(0, 0, 0, 0.4) 100%)`,
                backgroundColor: "rgb(16, 18, 23)",
                padding: "12px",
                minWidth: "260px",
                maxWidth: "380px",
                boxShadow:
                  "0 8px 24px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(0, 0, 0, 0.8)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  marginBottom: "10px",
                }}
              >
                {itemData?.imageUrl && (
                  <img
                    src={itemData.imageUrl}
                    alt={itemName}
                    style={{
                      width: "36px",
                      height: "36px",
                      flexShrink: 0,
                      border: `1.5px solid ${borderColor}`,
                      backgroundColor: getDarkBackgroundColor(itemType),
                      borderRadius: "3px",
                      objectFit: "contain",
                    }}
                  />
                )}
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: "15px",
                    color: borderColor,
                    letterSpacing: "0.3px",
                  }}
                >
                  {itemName}
                </div>
              </div>

              {itemData && (
                <>
                  <div
                    style={{
                      fontSize: "11.5px",
                      marginBottom: "10px",
                      display: "flex",
                      gap: "8px",
                      paddingBottom: "8px",
                      borderBottom: `1px solid rgba(${r}, ${g}, ${b}, 0.2)`,
                    }}
                  >
                    <span>{itemData.itemType}</span>
                    {itemData.requiredLevel && (
                      <>
                        <span>•</span>
                        <span>{itemData.requiredLevel}</span>
                      </>
                    )}
                  </div>

                  {itemData.runes && (
                    <div
                      style={{
                        fontSize: "12px",
                        marginBottom: "10px",
                        color: "#fbbf24",
                        fontWeight: 600,
                        padding: "6px 8px",
                        backgroundColor: "rgba(251, 191, 36, 0.1)",
                        borderRadius: "3px",
                        border: "1px solid rgba(251, 191, 36, 0.3)",
                      }}
                    >
                      {itemData.runes}
                    </div>
                  )}

                  {attributeList.length > 0 && (
                    <div style={{ fontSize: "12px", lineHeight: "1.6" }}>
                      {attributeList.map((attr, i) => (
                        <div
                          key={i}
                          style={{ marginBottom: "4px", paddingLeft: "4px" }}
                        >
                          {attr}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>,
          document.body
        )}
    </>
  );
};
