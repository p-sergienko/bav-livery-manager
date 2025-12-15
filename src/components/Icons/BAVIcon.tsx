type BAVIconProps = {
    width: number,
    height: number,
}

export const BAVIcon = ({ width, height }: BAVIconProps) => {
    return (
        <svg width={width} height={height} style={{ margin: "-1000px 0 -1000px" }} viewBox={`0 0 512 512`}
             fill="currentColor">
            <path
                d="M62.146 191.18c-.635.037-1.192.324-1.5.877L18.39 256.584h193.76L63.588 191.488a2.96 2.96 0 0 0-1.442-.308M18.39 288.146l42.256 64.528c.332.596.957.883 1.655.88a3 3 0 0 0 1.287-.312l148.562-65.096Z"
                transform="translate(4 -16.365)"/>
            <path
                d="M485.703 272.365c0 3.414-34.441 6.54-89.197 8.098l-172.291 64.133v-64.91c-41.863-1.716-66.56-4.433-66.55-7.32zm0 0c0-3.414-34.441-6.54-89.197-8.097l-172.291-64.133v64.91c-41.863 1.716-66.56 4.432-66.55 7.32z"
                transform="translate(4 -16.365)"/>
        </svg>
    );
};