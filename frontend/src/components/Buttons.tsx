import { Button } from "@chakra-ui/react";

export const PlayButton = (
  {label, gametype, handler}:{
    label: string;
    gametype: string;
    handler: (gameType: string) => void;
  }
) => {
  return (
    <Button
      onClick={() => handler(gametype)}
      w="full"
      size="lg"
      fontSize="3xl"
      fontWeight="bold"
      py={6}
      h="auto"
      bg="linear-gradient(135deg, #f6ad55, #ed8936)"
      color="white"
      rounded="xl"
      boxShadow="lg"
      border="2px solid transparent"
      _hover={{
        bg: "linear-gradient(135deg, #ed8936, #dd6b20)",
        transform: "translateY(-2px)",
        boxShadow: "xl",
        borderColor: "orange.300"
      }}
      _active={{
        transform: "translateY(0px)",
        boxShadow: "lg"
      }}
      _focus={{
        boxShadow: "0 0 0 3px rgba(237, 137, 54, 0.3)",
        outline: "none"
      }}
      transition="all 0.2s ease"
    >
      {label}
    </Button>
  );
};


export const ReconnectButton = (
  {handler}:{
    handler: () => void;
  }
) => {
  return (
    <Button
      onClick={handler}
      size="md"
      fontSize="lg"
      fontWeight="bold"
      py={2}
      marginX={2}
      h="auto"
      bg="linear-gradient(135deg, #f6ad55, #ed8936)"
      color="white"
      rounded="lg"
      boxShadow="md"
      border="2px solid transparent"
      _hover={{
        bg: "linear-gradient(135deg, #ed8936, #dd6b20)",
        transform: "translateY(-1px)",
        boxShadow: "lg",
        borderColor: "orange.300"
      }}
      _active={{
        transform: "translateY(0px)",
        boxShadow: "md"
      }}
      _focus={{
        boxShadow: "0 0 0 3px rgba(237, 137, 54, 0.3)",
        outline: "none"
      }}
      transition="all 0.2s ease"
    >
      Reconnect
    </Button>
  );
};
