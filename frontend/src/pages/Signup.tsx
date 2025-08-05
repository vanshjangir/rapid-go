import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Flex,
  Heading,
  Text,
  Input,
  Button,
  VStack,
  FormControl,
  FormLabel,
  Link
} from "@chakra-ui/react";

const Signup: React.FC = () => {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const nav = useNavigate();
  const httpapi = import.meta.env.VITE_HTTP_URL;

  const handleSignup = async () => {
    const response = await fetch(httpapi + '/signup', {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        "email": email,
        "password": password,
        "username": username,
      }),
    });

    if (response.status === 200) {
      console.log("Signup successful");
      nav("/");
    } else {
      setError("Signup unsuccessful");
      console.log("Signup unsuccessful");
    }
  };

  return (
    <Flex h="100vh" bg="#222222" color="white" direction="column">
      <Flex
        direction="column"
        alignItems="center"
        justifyContent="center"
        flex="1"
        px={6}
        py={12}
      >
        <Heading as="h1" fontSize="3xl" fontWeight="semibold" textAlign="center" mb={6}>
          Sign Up
        </Heading>
        {error && <Text color="red.500" mb={4}>{error}</Text>}
        <Box w="full" maxW="md" bg="#333333" p={8} borderRadius="lg">
          <VStack spacing={4}>
            <FormControl>
              <FormLabel htmlFor="email" fontSize="lg">Email</FormLabel>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                p={3}
                bg="#444444"
                color="white"
                borderRadius="lg"
                border="1px"
                borderColor="#555555"
                _focus={{ outline: "none", boxShadow: "0 0 0 2px var(--chakra-colors-blue-500)" }}
                placeholder="Enter your email"
              />
            </FormControl>
            <FormControl>
              <FormLabel htmlFor="username" fontSize="lg">Username</FormLabel>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                p={3}
                bg="#444444"
                color="white"
                borderRadius="lg"
                border="1px"
                borderColor="#555555"
                _focus={{ outline: "none", boxShadow: "0 0 0 2px var(--chakra-colors-blue-500)" }}
                placeholder="Enter your username"
              />
            </FormControl>
            <FormControl>
              <FormLabel htmlFor="password" fontSize="lg">Password</FormLabel>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                p={3}
                bg="#444444"
                color="white"
                borderRadius="lg"
                border="1px"
                borderColor="#555555"
                _focus={{ outline: "none", boxShadow: "0 0 0 2px var(--chakra-colors-blue-500)" }}
                placeholder="Enter your password"
              />
            </FormControl>
            <FormControl>
              <FormLabel htmlFor="confirm-password" fontSize="lg">Confirm Password</FormLabel>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                p={3}
                bg="#444444"
                color="white"
                borderRadius="lg"
                border="1px"
                borderColor="#555555"
                _focus={{ outline: "none", boxShadow: "0 0 0 2px var(--chakra-colors-blue-500)" }}
                placeholder="Confirm your password"
              />
            </FormControl>
            <Flex justifyContent="center" w="full">
              <Button
                onClick={handleSignup}
                w="full"
                py={3}
                bg="blue.600"
                borderRadius="lg"
                _hover={{ bg: "blue.500" }}
                _focus={{ outline: "none", boxShadow: "0 0 0 3px var(--chakra-colors-blue-300)" }}
              >
                Sign Up
              </Button>
            </Flex>
          </VStack>
        </Box>
        <Text textAlign="center" fontSize="sm" color="gray.400" mt={6}>
          Already have an account? <Link href="/login" color="blue.400" _hover={{ textDecoration: "underline" }}>Log In</Link>
        </Text>
      </Flex>
    </Flex>
  );
};

export default Signup;
