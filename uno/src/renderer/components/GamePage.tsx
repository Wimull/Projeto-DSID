import React from 'react'

export default function GamePage() {
    const [showColorPicker, setShowColorPicker] = React.useState(false)
    const [selectedColor, setSelectedColor] = React.useState<string | null>(
        null
    )
    const [playedColor, setPlayedColor] = React.useState<string | null>('blue')
    const [playedCard, setPlayedCard] = React.useState<string>('blue9')
    const [selectedCard, setSelectedCard] = React.useState<string | null>(null)
    const [hand, setHand] = React.useState<string[]>([
        'yellow9',
        'red1',
        'bluePlus2',
        'blueReverse',
        'blueStop',
        'wild',
        'wild4',
    ])
    const [otherPlayers, setOtherPlayers] = React.useState<
        {
            name: string
            id: string
            hand: string[]
        }[]
    >([
        {
            name: 'Player 1',
            id: '1',
            hand: ['back', 'back', 'back', 'back', 'back', 'back', 'back'],
        },
        {
            name: 'Player 2',
            id: '2',
            hand: ['back', 'back', 'back', 'back', 'back', 'back', 'back'],
        },
        {
            name: 'Player 3',
            id: '3',
            hand: ['back', 'back', 'back', 'back', 'back', 'back', 'back'],
        },
    ])

    function canPlayCard(card: string): boolean {
        if ((card === 'wild' || card === 'wild4') && selectedColor) {
            return true
        }

        const cardColor = card.match(/red|blue|green|yellow/)?.[0]
        if (playedColor === cardColor) return true

        const playedValue = playedCard.match(
            /0|1|2|3|4|5|6|7|8|9|Plus2|Reverse|Stop/
        )?.[0]
        const cardValue = card.match(
            /0|1|2|3|4|5|6|7|8|9|Plus2|Reverse|Stop/
        )?.[0]
        if (playedValue === cardValue) return true

        return false
    }

    function onClickCard(card: string) {
        setSelectedCard(card)
        if (card.startsWith('wild')) {
            setSelectedColor(null)
            setShowColorPicker(true)
        } else {
            setShowColorPicker(false)
        }
    }

    return (
        <div className="flex relative flex-col items-center justify-center min-h-screen bg-gray-100 min-w-screen overflow-hidden">
            {otherPlayers[0] && (
                <div className="mb-auto isolate relative z-10 flex flex-col w-full min-w-[90vw] justify-around items-center gap-2">
                    <div className="absolute -inset-0.5 bg-amber-400 rounded-lg blur-sm opacity-70"></div>
                    <h2 className="relative z-10 text-xl font-bold text-amber-800">
                        {otherPlayers[0].name}
                    </h2>
                    <div className="relative z-10 flex gap-4 max-w-[80vw]  p-4 overflow-x-auto">
                        {otherPlayers[0].hand.map((card, index) => (
                            <div key={index}>
                                <img
                                    src={'/' + card + '.png'}
                                    alt={card}
                                    className="object-center rounded-xl min-h-32 max-h-32 max-w-20 min-w-20 shadow-lg shadow-amber-800"
                                />
                            </div>
                        ))}
                    </div>
                </div>
            )}
            {otherPlayers[1] && (
                <div className="absolute isolate  top-0 bottom-0 left-0 flex w-fit justify-between items-center ">
                    <div className="mr-auto relative z-10 flex w-fit h-full min-h-[40vh] justify-around items-center gap-2 ">
                        <div className="absolute -inset-0.5 bg-amber-400 rounded-lg blur-sm opacity-70"></div>
                        <h2 className="relative rotate-90 z-10 text-xl font-bold text-amber-800">
                            {otherPlayers[1].name}
                        </h2>
                        <div className="relative z-10 flex  flex-col  gap-4 max-h-[40vh]  p-4 overflow-y-auto overflow-x-hidden">
                            {otherPlayers[1].hand.map((card, index) => (
                                <div
                                    key={index}
                                    className="flex z-20 justify-center items-center overflow-hidden min-w-32  max-w-32 max-h-20 min-h-20 shadow-lg shadow-amber-800 rounded-xl"
                                >
                                    <img
                                        src={'/' + card + '.png'}
                                        alt={card}
                                        className="object-center min-h-32 transform-[rotate(90deg)] max-h-32 max-w-20 min-w-20  "
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
            {otherPlayers[2] && (
                <div className="absolute isolate top-0 bottom-0 right-0 flex w-fit justify-between items-center ">
                    <div className="ml-auto relative z-10 flex w-fit h-full min-h-[40vh] justify-around items-center gap-2 ">
                        <div className="absolute -inset-0.5 bg-amber-400 rounded-lg blur-sm opacity-70"></div>

                        <div className="relative z-10 flex  flex-col  gap-4 max-h-[40vh]  p-4 overflow-y-auto overflow-x-hidden">
                            {otherPlayers[2].hand.map((card, index) => (
                                <div
                                    key={index}
                                    className="flex z-20 justify-center items-center overflow-hidden min-w-32  max-w-32 max-h-20 min-h-20 shadow-lg shadow-amber-800 rounded-xl"
                                >
                                    <img
                                        src={'/' + card + '.png'}
                                        alt={card}
                                        className="object-center min-h-32 transform-[rotate(90deg)] max-h-32 max-w-20 min-w-20  "
                                    />
                                </div>
                            ))}
                        </div>
                        <h2 className="relative rotate-90 z-10 text-xl font-bold text-amber-800">
                            {otherPlayers[2].name}
                        </h2>
                    </div>
                </div>
            )}
            <div className="absolute isolate top-[45vh] left-[50vw] translate-x-[-50%] translate-y-[-50%] flex w-fit justify-center items-center gap-16">
                <div
                    className={`absolute isolate w-full gap-8 text-2xl -top-10 left-[50%] translate-x-[-50%] n z-30 flex items-center justify-center transition-opacity ${playedCard.startsWith('wild') ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                >
                    {playedColor === 'red' ? (
                        <span className="text-red-500 font-bold">
                            Cor Escolhida: Vermelho
                        </span>
                    ) : playedColor === 'blue' ? (
                        <span className="text-blue-500 font-bold">
                            Cor Escolhida: Azul
                        </span>
                    ) : playedColor === 'green' ? (
                        <span className="text-green-500 font-bold">
                            Cor Escolhida: Verde
                        </span>
                    ) : playedColor === 'yellow' ? (
                        <span className="text-yellow-500 font-bold">
                            Cor Escolhida: Amarelo
                        </span>
                    ) : null}
                </div>
                <button
                    type="button"
                    className={`relative h-35 w-23 z-20 hover:scale-110 hover:z-20 rounded-3xl transition-all ${selectedCard === 'baralho' ? 'scale-110 z-20' : ''}`}
                    onClick={() => onClickCard('baralho')}
                >
                    <img
                        src={'/back.png'}
                        alt={'baralho'}
                        className="absolute top-0 left-0 object-center rounded-xl min-h-32 max-h-32 max-w-20 min-w-20 shadow-lg shadow-amber-800"
                    />
                    <img
                        src={'/back.png'}
                        alt={'baralho'}
                        className="absolute top-1 left-1 object-center rounded-xl min-h-32 max-h-32 max-w-20 min-w-20 shadow-lg shadow-amber-800"
                    />
                    <img
                        src={'/back.png'}
                        alt={'baralho'}
                        className="absolute top-2 left-2 object-center rounded-xl min-h-32 max-h-32 max-w-20 min-w-20 shadow-lg shadow-amber-800"
                    />
                    <img
                        src={'/back.png'}
                        alt={'baralho'}
                        className="absolute top-3 left-3 object-center rounded-xl min-h-32 max-h-32 max-w-20 min-w-20 shadow-lg shadow-amber-800"
                    />
                </button>
                <div>
                    <img
                        src={'/' + playedCard + '.png'}
                        alt={playedCard}
                        className="object-center rounded-2xl min-h-42 max-h-42 max-w-26 min-w-26 shadow-lg shadow-amber-800"
                    />
                </div>
            </div>

            <div
                className={`absolute isolate gap-8 text-2xl bottom-60 left-[50%] translate-x-[-50%] n z-30 flex items-center justify-center transition-opacity ${showColorPicker ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
            >
                <button
                    className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600"
                    onClick={() => {
                        setSelectedColor('red')
                        setShowColorPicker(false)
                    }}
                >
                    Vermelho
                </button>
                <button
                    className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600"
                    onClick={() => {
                        setSelectedColor('blue')
                        setShowColorPicker(false)
                    }}
                >
                    Azul
                </button>
                <button
                    className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600"
                    onClick={() => {
                        setSelectedColor('green')
                        setShowColorPicker(false)
                    }}
                >
                    Verde
                </button>
                <button
                    className="bg-yellow-500 text-white px-4 py-2 rounded-lg hover:bg-yellow-600"
                    onClick={() => {
                        setSelectedColor('yellow')
                        setShowColorPicker(false)
                    }}
                >
                    Amarelo
                </button>
            </div>

            <div className="mt-auto isolate relative z-10 flex w-full min-w-[90vw] justify-around items-center gap-4 ">
                <div className="absolute -inset-0.5 bg-amber-400 rounded-lg blur-sm opacity-70"></div>
                <div className="relative z-10 flex gap-4 max-w-[80vw]  p-4 overflow-x-auto">
                    {hand.map((card, index) => (
                        <button
                            key={index}
                            className={`hover:scale-110 hover:z-20 rounded-3xl transition-all ${selectedCard === card ? 'border-4  border-blue-500 scale-110 z-20' : ''}`}
                            type="button"
                            onClick={() => onClickCard(card)}
                        >
                            <img
                                src={'/' + card + '.png'}
                                alt={card}
                                className="object-center rounded-3xl min-h-48 max-h-48 max-w-32 min-w-32 shadow-lg shadow-amber-800"
                            />
                        </button>
                    ))}
                </div>
                <button
                    className={` px-4 z-10 py-2 w-52 text-white bg-blue-500 rounded hover:bg-blue-600 font-bold text-2xl disabled:opacity-50 disabled:cursor-not-allowed ${selectedCard?.startsWith('wild') && selectedColor ? (selectedColor === 'blue' ? 'bg-blue-700' : selectedColor === 'green' ? 'bg-green-500' : selectedColor === 'yellow' ? 'bg-yellow-700' : '') : ''}`}
                    type="button"
                    disabled={
                        !selectedCard ||
                        !(
                            canPlayCard(selectedCard) ||
                            selectedCard === 'baralho'
                        )
                    }
                >
                    {selectedCard === 'baralho'
                        ? 'Comprar Carta'
                        : 'Jogar Carta'}
                </button>
            </div>
        </div>
    )
}
