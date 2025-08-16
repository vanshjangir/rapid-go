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
  const BACKEND_URL = import.meta.env.PROD ?
    import.meta.env.VITE_HTTPS_URL :
    import.meta.env.VITE_HTTP_URL;

  const handleLogin = async () => {
    const response = await fetch(BACKEND_URL + '/login', {
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

    const response = await fetch(BACKEND_URL + '/login', {
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

  const handleGuestLogin = async () => {
    const response = await fetch(BACKEND_URL + '/login', {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        "type": "guest",
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
  }

  return (
    <Flex 
      minH="100vh" 
      bg="linear-gradient(135deg, #1a202c 0%, #2d3748 25%, #4a5568 50%, #2d3748 75%, #1a202c 100%)"
      color="white" 
      direction="column"
      position="relative"
      overflow="hidden"
    >
      <Flex
        direction="column"
        alignItems="center"
        justifyContent="center"
        flex="1"
        px={6}
        py={12}
        position="relative"
        zIndex={1}
      >
        {/* Header */}
        <VStack spacing={2} mb={8} textAlign="center">
          <Heading 
            as="h1" 
            fontSize={{ base: "3xl", md: "4xl" }}
            fontWeight="900"
            bgGradient="linear(to-r, #f6ad55, #ed8936, #dd6b20)"
            bgClip="text"
            letterSpacing="tight"
          >
            Welcome Back
          </Heading>
          <Text color="gray.300" fontSize="lg">
            Sign in to your account
          </Text>
        </VStack>

        {/* Error Message */}
        {error && (
          <Box
            bg="red.900"
            borderColor="red.500"
            border="1px solid"
            color="red.200"
            px={4}
            py={3}
            borderRadius="lg"
            mb={6}
            maxW="md"
            w="full"
          >
            <Text textAlign="center">{error}</Text>
          </Box>
        )}

        {/* Form Container */}
        <Box 
          w="full" 
          maxW="md" 
          bg="linear-gradient(135deg, rgba(26, 32, 44, 0.9), rgba(45, 55, 72, 0.8))"
          backdropFilter="blur(12px)"
          p={8} 
          borderRadius="2xl"
          border="2px solid"
          borderColor="whiteAlpha.200"
          boxShadow="0 8px 32px rgba(0, 0, 0, 0.3)"
        >
          <VStack spacing={6}>
            <FormControl>
              <FormLabel htmlFor="email" fontSize="sm" color="gray.300" fontWeight="600">
                Email
              </FormLabel>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                py={3}
                px={4}
                bg="rgba(26, 32, 44, 0.6)"
                color="white"
                borderRadius="xl"
                border="1px solid"
                borderColor="whiteAlpha.300"
                _hover={{ borderColor: "orange.300" }}
                _focus={{ 
                  outline: "none", 
                  borderColor: "orange.400",
                  boxShadow: "0 0 0 3px rgba(246, 173, 85, 0.1)"
                }}
                placeholder="Enter your email"
                _placeholder={{ color: "gray.500" }}
              />
            </FormControl>

            <FormControl>
              <FormLabel htmlFor="password" fontSize="sm" color="gray.300" fontWeight="600">
                Password
              </FormLabel>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                py={3}
                px={4}
                bg="rgba(26, 32, 44, 0.6)"
                color="white"
                borderRadius="xl"
                border="1px solid"
                borderColor="whiteAlpha.300"
                _hover={{ borderColor: "orange.300" }}
                _focus={{ 
                  outline: "none", 
                  borderColor: "orange.400",
                  boxShadow: "0 0 0 3px rgba(246, 173, 85, 0.1)"
                }}
                placeholder="Enter your password"
                _placeholder={{ color: "gray.500" }}
              />
            </FormControl>

            <Button
              onClick={handleLogin}
              w="full"
              py={3}
              h="auto"
              bg="linear-gradient(135deg, #f6ad55, #ed8936)"
              color="white"
              borderRadius="xl"
              fontWeight="700"
              fontSize="lg"
              transition="all 0.3s ease"
              _hover={{ 
                transform: "translateY(-2px)",
                boxShadow: "0 8px 25px rgba(237, 137, 54, 0.3)",
                bg: "linear-gradient(135deg, #ed8936, #dd6b20)"
              }}
              _active={{ transform: "translateY(0)" }}
            >
              Log In
            </Button>
            
            <HStack alignItems="center" my={4} w="full">
              <Divider borderColor="whiteAlpha.300" flex="1" />
              <Text mx={4} color="gray.400" fontSize="sm" fontWeight="500">
                OR
              </Text>
              <Divider borderColor="whiteAlpha.300" flex="1" />
            </HStack>

            <Button
              onClick={handleGuestLogin}
              w="full"
              py={3}
              h="auto"
              bg="linear-gradient(135deg, #f6ad55, #ed8936)"
              color="white"
              borderRadius="xl"
              fontWeight="700"
              fontSize="lg"
              transition="all 0.3s ease"
              _hover={{ 
                transform: "translateY(-2px)",
                boxShadow: "0 8px 25px rgba(237, 137, 54, 0.3)",
                bg: "linear-gradient(135deg, #ed8936, #dd6b20)"
              }}
              _active={{ transform: "translateY(0)" }}
            >
              Log In as Guest
            </Button>

            <HStack alignItems="center" my={4} w="full">
              <Divider borderColor="whiteAlpha.300" flex="1" />
              <Text mx={4} color="gray.400" fontSize="sm" fontWeight="500">
                OR
              </Text>
              <Divider borderColor="whiteAlpha.300" flex="1" />
            </HStack>

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

          </VStack>
        </Box>

        {/* Footer */}
        <Text textAlign="center" fontSize="sm" color="gray.400" mt={8}>
          Don't have an account?{" "}
          <Link 
            href="/signup" 
            color="orange.300" 
            fontWeight="600"
            _hover={{ 
              color: "orange.200",
              textDecoration: "underline" 
            }}
          >
            Sign Up
          </Link>
        </Text>
      </Flex>
    </Flex>
  );
};

export default Login;
