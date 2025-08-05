import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Flex,
  Box,
  Text,
  Button,
  Link,
  IconButton,
  VStack,
  HStack,
  useDisclosure,
  Collapse
} from "@chakra-ui/react";
import { HamburgerIcon, CloseIcon } from "@chakra-ui/icons";

const Navbar: React.FC = () => {
  const { isOpen, onToggle } = useDisclosure();
  const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
  const username = localStorage.getItem('username');
  const [logged, setLogged] = useState<boolean>(isLoggedIn);
  const nav = useNavigate();

  useEffect(() => {
    setLogged(isLoggedIn);
  }, [isLoggedIn]);

  const handleLogout = () => {
    localStorage.clear();
    setLogged(false);
  };

  return (
    <Box bg="#222222" color="white" fontSize="3xl" mt={4}>
      <Box maxW="5xl" mx="auto" px={{ base: 4, sm: 6, lg: 8 }}>
        <Flex justify="space-between" h={16} align="center">
          <Flex align="center">
            <Link href="/" _hover={{ textDecoration: 'none' }}>
              <Text as="h1" fontSize="6xl" fontWeight="bold" color="gray.300" _hover={{ color: "white" }}>
                Rapid Go
              </Text>
            </Link>
          </Flex>

          <HStack spacing={4} display={{ base: "none", md: "flex" }} align="center">
            {logged ? (
              <HStack spacing={4}>
                <Link
                  onClick={() => nav(`/profile/${username}`)}
                  color="gray.300"
                  fontWeight="bold"
                  _hover={{ textDecoration: 'underline' }}
                >
                  {username}
                </Link>
                <Button
                  onClick={handleLogout}
                  bg="gray.300"
                  _hover={{ bg: "gray.500" }}
                  rounded="md"
                  px={4}
                  py={2}
                >
                  Logout
                </Button>
              </HStack>
            ) : (
              <>
                <Button
                  as={Link}
                  href="/login"
                  bg="gray.300"
                  _hover={{ bg: "gray.500" }}
                  rounded="md"
                  px={4}
                  py={2}
                >
                  Login
                </Button>
                <Button
                  as={Link}
                  href="/signup"
                  bg="blue.400"
                  _hover={{ bg: "blue.500" }}
                  rounded="md"
                  px={4}
                  py={2}
                >
                  Sign Up
                </Button>
              </>
            )}
          </HStack>

          <IconButton
            size="md"
            icon={isOpen ? <CloseIcon /> : <HamburgerIcon />}
            aria-label="Open Menu"
            display={{ md: "none" }}
            onClick={onToggle}
            bg="gray.700"
            color="gray.400"
            _hover={{ bg: "gray.700", color: "white" }}
          />
        </Flex>
      </Box>

      <Collapse in={isOpen} animateOpacity>
        <Box pb={3} display={{ md: 'none' }}>
          <VStack spacing={1} px={2} pt={2}>
            {logged ? (
              <>
                <Link
                  onClick={() => nav(`/profile/${username}`)}
                  color="gray.300"
                  fontWeight="bold"
                  _hover={{ textDecoration: 'underline' }}
                  w="full"
                  px={4}
                  py={2}
                >
                  {username}
                </Link>
                <Button
                  onClick={handleLogout}
                  bg="gray.600"
                  _hover={{ bg: "gray.500" }}
                  rounded="md"
                  w="full"
                  px={3}
                  py={2}
                >
                  Logout
                </Button>
              </>
            ) : (
              <>
                <Button
                  as={Link}
                  href="/login"
                  bg="gray.600"
                  _hover={{ bg: "gray.500" }}
                  rounded="md"
                  w="full"
                  px={3}
                  py={2}
                >
                  Login
                </Button>
                <Button
                  as={Link}
                  href="/signup"
                  bg="blue.600"
                  _hover={{ bg: "blue.500" }}
                  rounded="md"
                  w="full"
                  px={3}
                  py={2}
                >
                  Sign Up
                </Button>
              </>
            )}
          </VStack>
        </Box>
      </Collapse>
    </Box>
  );
};

export default Navbar;
