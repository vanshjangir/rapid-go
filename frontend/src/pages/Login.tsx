import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CredentialResponse, GoogleLogin } from "@react-oauth/google";
import { useGlobalContext } from "../GlobalContext";
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
  Link,
  Divider,
  HStack
} from "@chakra-ui/react";

const Login: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const nav = useNavigate();
  const { setUsername } = useGlobalContext();
  const httpapi = import.meta.env.VITE_HTTP_URL;

  const handleLogin = async () => {
    const response = await fetch(httpapi + '/login', {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        "type": "email",
        "email": email,
        "password": password,
        "credential": "",
      }),
    });

    if (response.status === 200) {
      const json = await response.json();
      console.log("Login successful");
      localStorage.setItem("token", json.token);
      localStorage.setItem("username", json.username);
      localStorage.setItem('isLoggedIn', 'true');
      setUsername(json.username);
      nav("/");
    } else {
      setError("Login unsuccessful");
      console.log("Login unsuccessful");
    }
  };

  const handleGoogleLogin = async (credentialResponse: CredentialResponse) => {
    if (!credentialResponse.credential) {
      setError("Google Login unsuccessful");
      console.log("Google Login unsuccessful");
      return;
    }

    const response = await fetch(httpapi + '/login', {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        "type": "google-token",
        "email": "",
        "password": "",
        "credential": credentialResponse.credential,
      }),
    });

    if (response.status === 200) {
      const json = await response.json();
      console.log("Login successful");
      localStorage.setItem("token", json.token);
      localStorage.setItem("username", json.username);
      localStorage.setItem('isLoggedIn', 'true');
      setUsername(json.username);
      nav("/");
    } else {
      setError("Google Login unsuccessful");
      console.log("Google Login unsuccessful");
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
          Login
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
            <Flex justifyContent="center" w="full">
              <Button
                onClick={handleLogin}
                w="full"
                py={3}
                bg="blue.600"
                borderRadius="lg"
                _hover={{ bg: "blue.500" }}
                _focus={{ outline: "none", boxShadow: "0 0 0 3px var(--chakra-colors-blue-300)" }}
              >
                Login
              </Button>
            </Flex>
            <HStack alignItems="center" my={6} w="full">
              <Divider borderColor="gray.600" flex="1" />
              <Text mx={4} color="gray.400">OR</Text>
              <Divider borderColor="gray.600" flex="1" />
            </HStack>
            <Flex justifyContent="center">
              <GoogleLogin
                onSuccess={(credentialResponse) => {
                  handleGoogleLogin(credentialResponse);
                }}
                onError={() => {
                  console.log("Google Login Failed");
                  setError("Google Login unsuccessful");
                }}
                useOneTap
              />
            </Flex>
          </VStack>
        </Box>
        <Text textAlign="center" fontSize="sm" color="gray.400" mt={6}>
          Don't have an account? <Link href="/signup" color="blue.400" _hover={{ textDecoration: "underline" }}>Sign Up</Link>
        </Text>
      </Flex>
    </Flex>
  );
};

export default Login;
